// Answers questions about the group's policies, quoting them.
//
// Runs as an Edge Function so GEMINI_API_KEY stays server-side; a VITE_
// variable would be readable by anyone who opens devtools.
//
// The model is told to answer only from the supplied policies and to quote
// them verbatim. That instruction isn't trusted: every quote it returns is
// checked against the policy it claims to come from, here and again in the
// browser, and anything that doesn't match is dropped before display.
//
// Deploy: Supabase dashboard -> Edge Functions -> new function "policy-chat",
// paste this file, then set the GEMINI_API_KEY secret.

// Overridable with a GEMINI_MODEL secret, so the model can be changed without
// editing code. Model availability varies by key and changes over time, and a
// name hardcoded here is the kind of thing that silently stops working.
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";

/**
 * Asks Google which models this key can actually use.
 *
 * A 404 on generateContent means the configured name isn't available, and the
 * error alone doesn't say what is — which leaves you guessing. Listing them
 * turns a dead end into something actionable.
 */
async function listUsableModels(apiKey: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    if (!res.ok) return "";
    const body = await res.json();
    const names = (body?.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((m: { name: string }) => m.name.replace(/^models\//, ""))
      .slice(0, 12);
    return names.length > 0 ? ` Models available on this key: ${names.join(", ")}.` : "";
  } catch {
    return "";
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Policy = { id: string; title: string; content: string };

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function quoteAppearsIn(content: string, quote: string): boolean {
  const needle = normalize(quote);
  if (needle.length < 12) return false;
  return normalize(content).includes(needle);
}

function buildPrompt(policies: Policy[], question: string, history: string): string {
  const documents = policies
    .map((p) => `### DOCUMENT id=${p.id}\n### TITLE: ${p.title}\n${p.content}`)
    .join("\n\n---\n\n");

  return [
    "You answer questions about a Scout group's policies, for leaders who need",
    "to know what the rules actually say.",
    "",
    "STRICT RULES:",
    "- Answer ONLY from the documents below. They are your sole source.",
    "- Do not use outside knowledge about Scouting, safety or the law.",
    "- If the documents don't cover the question, say so plainly. Do not guess.",
    "- Every claim must be supported by a citation quoting the document word for word.",
    "- Quotes must be copied EXACTLY from the document, not paraphrased or tidied up.",
    "- Quote at least a full clause, never one or two words.",
    "- Never invent a document, a title, a quote, or a section number.",
    "",
    'Reply as JSON: {"answer": string, "citations": [{"policy_id": string, "quote": string}]}',
    "The quote must be an exact substring of that document's text.",
    "",
    history ? `EARLIER IN THIS CONVERSATION:\n${history}\n` : "",
    "DOCUMENTS:",
    documents,
    "",
    `QUESTION: ${question}`,
  ]
    .filter(Boolean)
    .join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY is not set on the function." }, 500);

    // Only signed-in users may spend the quota.
    if (!req.headers.get("Authorization")?.startsWith("Bearer ")) {
      return json({ error: "Not signed in." }, 401);
    }

    const { policies, question, history } = (await req.json()) as {
      policies?: Policy[];
      question?: string;
      history?: string;
    };

    if (!question?.trim()) return json({ error: "No question asked." }, 400);
    if (!Array.isArray(policies) || policies.length === 0) {
      return json({ error: "No policies have been added yet." }, 400);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(policies, question, history ?? "") }] }],
          generationConfig: {
            // Low temperature: this should read the documents, not write prose.
            temperature: 0.1,
            // Generous, because the reply carries the answer plus verbatim
            // quotes. Running out mid-object produces truncated JSON that
            // can't be parsed, which surfaces as an unhelpful 502.
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      // A 404 means the configured model name isn't usable on this key, so
      // say which ones are rather than leaving it to trial and error.
      const suggestion = response.status === 404 ? await listUsableModels(apiKey) : "";
      return json(
        {
          error: `Gemini request failed (${response.status})`,
          detail: `Using model "${MODEL}". ${detail}${suggestion}`,
        },
        502,
      );
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const finish: string | undefined = candidate?.finishReason;

    // Gemini can decline before producing anything — say which, rather than
    // reporting an empty reply and leaving the cause invisible.
    if (data?.promptFeedback?.blockReason) {
      return json(
        {
          error: "Gemini declined to answer.",
          detail: `Blocked: ${data.promptFeedback.blockReason}`,
        },
        502,
      );
    }

    const text: string =
      candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

    if (!text.trim()) {
      return json(
        {
          error: "Gemini returned nothing.",
          detail: finish ? `Finish reason: ${finish}` : JSON.stringify(data).slice(0, 500),
        },
        502,
      );
    }

    let parsed: { answer?: string; citations?: { policy_id?: string; quote?: string }[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      // Without structured output there's no way to check citations, so this
      // is a failure rather than something to show unverified.
      return json(
        {
          error: "The assistant's reply couldn't be read.",
          detail:
            finish === "MAX_TOKENS"
              ? "The reply was cut off before it finished. Try a narrower question, or remove a policy."
              : `Finish reason: ${finish ?? "unknown"}. Reply began: ${text.slice(0, 300)}`,
        },
        502,
      );
    }

    const byId = new Map(policies.map((p) => [p.id, p]));
    const citations: { policy_id: string; policy_title: string; quote: string }[] = [];
    const rejected: { policy_title: string; quote: string }[] = [];

    for (const cite of parsed.citations ?? []) {
      const quote = (cite.quote ?? "").trim();
      const policy = cite.policy_id ? byId.get(cite.policy_id) : undefined;
      if (!quote) continue;
      if (!policy) {
        rejected.push({ policy_title: "Unknown document", quote });
        continue;
      }
      if (!quoteAppearsIn(policy.content, quote)) {
        rejected.push({ policy_title: policy.title, quote });
        continue;
      }
      citations.push({ policy_id: policy.id, policy_title: policy.title, quote });
    }

    return json({ answer: parsed.answer ?? "", citations, rejected });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
