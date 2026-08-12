// Rewrites camp safety facts into readable prose using Gemini.
//
// Runs as a Supabase Edge Function so GEMINI_API_KEY stays on the server. A
// VITE_ variable would be baked into the browser bundle and readable by
// anyone who opens devtools.
//
// The model is given facts and told to use nothing else. That instruction is
// not trusted: every number in the reply is checked against the facts before
// it is returned, and a reply containing an unknown number is rejected. The
// caller falls back to the deterministic template, so a refusal degrades to
// plain formatting rather than to a wrong document.
//
// Deploy: Supabase dashboard -> Edge Functions -> new function "safety-plan",
// paste this file, then set the GEMINI_API_KEY secret.

const MODEL = "gemini-2.0-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Fact = { label: string; value: string };

/** Whole components of every number in the text — never substrings. */
function expandNumber(token: string): string[] {
  const joined = token.replace(/\D/g, "");
  const groups = token.match(/\d+/g) ?? [];
  return [joined, ...groups].filter((d) => d.length >= 2);
}

function numericTokens(text: string): string[] {
  const matches = text.match(/\d[\d\s\-().+/]*\d|\d/g) ?? [];
  return matches.map((t) => t.replace(/\D/g, "")).filter((d) => d.length >= 2);
}

function unknownNumbers(facts: Fact[], generated: string): string[] {
  const allowed = new Set(
    facts.flatMap((f) => (f.value.match(/\d[\d\s\-().+/]*\d|\d/g) ?? []).flatMap(expandNumber)),
  );
  return [...new Set(numericTokens(generated).filter((t) => !allowed.has(t)))];
}

function buildPrompt(facts: Fact[]): string {
  return [
    "Rewrite the following camp safety information as clear, readable paragraphs",
    "for a Scout leader to print and carry.",
    "",
    "STRICT RULES:",
    "- Use ONLY the facts listed below. Do not add anything not listed.",
    "- Never invent or guess a phone number, address, hospital, name, date or quantity.",
    "- Every number you write must appear exactly as given in the facts.",
    "- If something is not listed, simply leave it out. Do not write a placeholder.",
    "- Do not offer medical, legal or procedural advice of your own.",
    "- Use headings and short paragraphs. Plain text only, no markdown.",
    "",
    "FACTS:",
    ...facts.map((f) => `- ${f.label}: ${f.value}`),
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "GEMINI_API_KEY is not set on the function." }, 500);
    }

    // Only signed-in users may spend the quota. The anon key alone isn't
    // enough; the client sends the user's session token.
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return json({ error: "Not signed in." }, 401);
    }

    const { facts } = (await req.json()) as { facts?: Fact[] };
    if (!Array.isArray(facts) || facts.length === 0) {
      return json({ error: "No facts supplied." }, 400);
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(facts) }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return json({ error: `Gemini request failed (${response.status})`, detail }, 502);
    }

    const data = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
      "";

    if (!text.trim()) {
      return json({ error: "Gemini returned nothing." }, 502);
    }

    // The guard. Prose may be rephrased freely; numbers may not be invented.
    const unknown = unknownNumbers(facts, text);
    if (unknown.length > 0) {
      return json(
        {
          error: "rejected",
          reason:
            "The generated text contained numbers that are not in your data, so it was discarded.",
          unknownNumbers: unknown,
        },
        422,
      );
    }

    return json({ text });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
