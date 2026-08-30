// Files the policy documents into categories, so a shelf of twenty PDFs
// reads as a shelf rather than a list.
//
// Given titles and a short opening excerpt — not the documents. A policy's
// subject is obvious from its first paragraph, and sending whole documents
// to decide "is this about transport" would cost real quota to learn nothing
// extra.
//
// The categories are a FIXED list, supplied in the prompt. Letting the model
// invent them produces "Safety", "Safeguarding" and "Child Safety" as three
// separate shelves, which is worse than no grouping at all.
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

export const CATEGORIES = [
  "Safety",
  "Young people",
  "Activities",
  "Camping",
  "Transport",
  "Money",
  "Running the group",
  "Other",
];

type Doc = { title: string; excerpt?: string };

function buildPrompt(docs: Doc[]): string {
  const list = docs
    .map((d) => {
      const excerpt = (d.excerpt ?? "").replace(/\s+/g, " ").slice(0, 300);
      return `- ${JSON.stringify(d.title)}${excerpt ? `\n    opens: ${excerpt}` : ""}`;
    })
    .join("\n");

  return [
    "You are filing a Scout group's policy documents onto labelled shelves.",
    "",
    "Put every document below into exactly one of these categories, and use",
    "them EXACTLY as written:",
    ...CATEGORIES.map((c) => `- ${c}`),
    "",
    "RULES:",
    "- Use the title as it appears below, character for character. Do not",
    "  tidy it, expand an abbreviation, or fix its spelling.",
    '- "Young people" covers safeguarding, behaviour, welfare and anything',
    "  about how adults deal with children.",
    '- "Safety" is physical risk: fire, water, heights, tools, first aid.',
    '- "Running the group" is membership, records, complaints, meetings.',
    '- Use "Other" when nothing fits. That is a real answer, not a failure —',
    "  a wrong shelf is worse than an honest one.",
    "- Every document appears exactly once in your reply.",
    "",
    'Reply as JSON: {"filed": [{"title": string, "category": string}]}',
    "",
    "DOCUMENTS:",
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

    const { documents } = (await req.json()) as { documents?: Doc[] };
    const docs = Array.isArray(documents)
      ? documents
          .filter((d): d is Doc => !!d && typeof d.title === "string")
          .slice(0, 100)
      : [];

    if (docs.length === 0) return json({ filed: [], categories: CATEGORIES });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(docs) }] }],
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

    if (!text.trim()) return json({ filed: [], categories: CATEGORIES });

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

    return json({ filed, categories: CATEGORIES });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
