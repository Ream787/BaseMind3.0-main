// Looks over the equipment list for spellings that are the same thing typed
// two ways, and says which one to keep.
//
// It is deliberately given the SMALL half of the job. Duplicate rows and
// case-only variants are computed in the browser, because those are facts
// and need no model. What comes here is the judgement: is "Strore Room" the
// same place as "Store Room"? Is "Contaner" the container? A person reads
// those instantly and a regex does not.
//
// Only the distinct locations and categories are sent, with counts - not the
// inventory. The question is about a few dozen short strings, so sending
// several hundred equipment rows would cost quota to tell it nothing.
//
// Nothing it returns is trusted: the browser checks every spelling against
// the values that genuinely exist before showing a suggestion.
//
// Deploy: Supabase dashboard -> Edge Functions -> new function
// "equipment-cleanup", paste this file. Uses the same GEMINI_API_KEY secret
// as policy-chat.

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Tally = { value: string; count: number };

function buildPrompt(locations: Tally[], categories: Tally[]): string {
  const list = (rows: Tally[]) =>
    rows.map((r) => `- ${JSON.stringify(r.value)} (used by ${r.count} items)`).join("\n");

  return [
    "You are tidying the equipment list of a Scout group. Below are the",
    "room names and category names currently in use, with how many items",
    "use each.",
    "",
    "Find values that are THE SAME THING typed differently: a misspelling,",
    "an abbreviation, a singular/plural, an extra word like \"the\".",
    "",
    "STRICT RULES:",
    "- Only ever use values exactly as they appear in the lists below.",
    "  Never invent a tidier name that is not already there.",
    '- "canonical" is the spelling to KEEP. Prefer the correctly spelled one;',
    "  where both are spelled correctly, prefer the one more items use.",
    '- "variants" are the other spellings of that same thing, and must not',
    "  include the canonical value itself.",
    "- Two things that are genuinely DIFFERENT places must never be grouped.",
    '  "Store Room" and "Storage Container" are different. "Loft" and',
    '  "Attic" are different words for a place and you cannot tell from here',
    "  whether the group means one place or two - leave them alone.",
    "- A difference of only capitalisation or spacing is already handled",
    "  elsewhere. Skip those; they are not worth reporting.",
    "- If nothing is genuinely the same thing typed twice, return an empty",
    "  list. That is a good answer, not a failure.",
    "",
    'Reply as JSON: {"findings": [{"kind": "location-variants" | "category-variants",',
    '"canonical": string, "variants": string[], "why": string}]}',
    '"why" is one short sentence a leader would find obvious, e.g.',
    '"Store Room is misspelled here."',
    "",
    `ROOMS:\n${list(locations) || "- (none)"}`,
    "",
    `CATEGORIES:\n${list(categories) || "- (none)"}`,
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

    const { locations, categories } = (await req.json()) as {
      locations?: Tally[];
      categories?: Tally[];
    };

    const rooms = Array.isArray(locations) ? locations.slice(0, 200) : [];
    const cats = Array.isArray(categories) ? categories.slice(0, 200) : [];

    // Nothing to compare against itself.
    if (rooms.length + cats.length < 2) return json({ findings: [] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(rooms, cats) }] }],
          generationConfig: {
            // This is a matching job, not a writing one.
            temperature: 0,
            maxOutputTokens: 2048,
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

    if (!text.trim()) return json({ findings: [] });

    let parsed: { findings?: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      return json(
        { error: "The reply couldn't be read.", detail: text.slice(0, 300) },
        502,
      );
    }

    // Shape only. Whether these values are real is decided in the browser,
    // against the actual inventory.
    const findings = Array.isArray(parsed.findings)
      ? parsed.findings
          .filter((f: unknown): f is Record<string, unknown> => !!f && typeof f === "object")
          .slice(0, 25)
      : [];

    return json({ findings });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
