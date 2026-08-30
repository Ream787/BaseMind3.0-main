// Files the policy documents into categories, so a shelf of twenty PDFs
// reads as a shelf rather than a list.
//
// Given titles and a short opening excerpt — not the documents. A policy's
// subject is obvious from its first paragraph, and sending whole documents
// to decide "is this about transport" would cost real quota to learn nothing
// extra.
//
// The shelves the group already uses are supplied in the prompt, and the
// model is told to prefer them and only invent one when a document genuinely
// belongs nowhere. Left entirely free it produces "Safety", "Safeguarding"
// and "Child Safety" as three separate shelves, which is worse than no
// grouping at all; a new shelf that differs from an existing one only by
// case is snapped back to it in the browser.
//
// Only documents with NO category are ever sent here. One already filed is
// somebody's decision, and this must not overwrite it.
//
// Nothing it returns is trusted: the browser checks every title against the
// real documents and every category against this list before anything moves.
//
// Deploy: Supabase dashboard -> Edge Functions -> new function
// "policy-sort", paste this file. Uses the same GEMINI_API_KEY as the rest.

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Offered when the group hasn't filed anything yet. */
const SUGGESTED = [
  "Safety",
  "Young people",
  "Activities",
  "Camping",
  "Transport",
  "Money",
  "Running the group",
];

type Doc = { title: string; excerpt?: string };

function buildPrompt(docs: Doc[], inUse: string[]): string {
  const shelves = (inUse.length > 0 ? inUse : SUGGESTED).map((c) => `- ${c}`);

  const list = docs
    .map((d) => {
      const excerpt = (d.excerpt ?? "").replace(/\s+/g, " ").slice(0, 300);
      return `- ${JSON.stringify(d.title)}${excerpt ? `\n    opens: ${excerpt}` : ""}`;
    })
    .join("\n");

  return [
    "You are filing a Scout group's policy documents onto labelled shelves.",
    "",
    "These shelves already exist. Prefer them:",
    ...shelves,
    "",
    "RULES:",
    "- Put every document below onto exactly one shelf.",
    "- Use the title as it appears below, character for character. Do not",
    "  tidy it, expand an abbreviation, or fix its spelling.",
    "- Strongly prefer a shelf that already exists. Only invent a new one",
    "  when a document genuinely belongs nowhere on the list — and then make",
    "  it short, plain and general enough to hold more than this one document.",
    "- Never invent a shelf that is a near-duplicate of an existing one.",
    '  If "Safety" exists, do not propose "Safeguarding" or "Child Safety".',
    "- Every document appears exactly once in your reply.",
    "",
    'Reply as JSON: {"filed": [{"title": string, "category": string}]}',
    "",
    "DOCUMENTS TO FILE:",
    list || "- (none)",
  ].join("\n");
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

    if (!req.headers.get("Authorization")?.startsWith("Bearer ")) {
      return json({ error: "Not signed in." }, 401);
    }

    const { documents, inUse } = (await req.json()) as {
      documents?: Doc[];
      inUse?: string[];
    };
    const shelves = Array.isArray(inUse)
      ? inUse.filter((c): c is string => typeof c === "string").slice(0, 40)
      : [];
    const docs = Array.isArray(documents)
      ? documents
          .filter((d): d is Doc => !!d && typeof d.title === "string")
          .slice(0, 100)
      : [];

    if (docs.length === 0) return json({ filed: [] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(docs, shelves) }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return json(
        { error: `Gemini request failed (${response.status})`, detail: detail.slice(0, 400) },
        502,
      );
    }

    const data = await response.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";

    if (!text.trim()) return json({ filed: [] });

    let parsed: { filed?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: "The reply couldn't be read.", detail: text.slice(0, 300) }, 502);
    }

    const filed = Array.isArray(parsed.filed)
      ? parsed.filed
          .filter((f: unknown): f is Record<string, unknown> => !!f && typeof f === "object")
          .slice(0, 200)
      : [];

    return json({ filed });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
