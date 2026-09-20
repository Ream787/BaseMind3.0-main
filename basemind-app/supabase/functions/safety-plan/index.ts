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

// Overridable with a GEMINI_MODEL secret, so the model can be changed without
// editing code. Availability varies by key and changes over time.
// Flash Lite is the cheapest tier and has the most generous free quota,
// which is what this is picked for. Its thinking level already defaults to
// minimal, so none of the output budget below is spent on reasoning.
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";

/** Which models this key can actually use, for when the configured one 404s. */
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

/**
 * Is this a real, approved member — not just anybody holding the app's
 * public key?
 *
 * The check used to be that the request carried a Bearer token of any kind.
 * The anon key is a Bearer token, and it ships inside the website, so the
 * group's Gemini quota was available to anyone who opened the page source.
 * Asking Supabase who the token belongs to is the only way to tell the two
 * apart, and the row is then read with that same token so row-level security
 * decides what comes back.
 */
async function callerIsActiveMember(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return false;

  const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!who.ok) return false;
  const id = ((await who.json()) as { id?: string })?.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return false;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?select=status&id=eq.${id}&limit=1`,
    { headers: { Authorization: authHeader, apikey: anonKey } },
  );
  if (!res.ok) return false;
  const [row] = (await res.json()) as { status?: string }[];
  return row?.status === "Active";
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

    // Only approved members may spend the quota.
    if (!(await callerIsActiveMember(req.headers.get("Authorization")))) {
      return json({ error: "Only signed-in members can rewrite a safety plan." }, 401);
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
