// Looks over the equipment list for spellings that are the same thing typed
// two ways, and says which one to keep.
//
// It is deliberately given the SMALL half of the job. Duplicate rows and
// case-only variants are computed in the browser, because those are facts
// and need no model. What comes here is the judgement: is "Strore Room" the
// same place as "Store Room"? Is "Contaner" the container? A person reads
// those instantly and a regex does not.
//
// What gets sent is names only: the distinct rooms and categories with
// counts, and the item names. Not quantities, conditions, notes or dates —
// the question is "are these two strings the same thing", and everything
// else would cost quota to tell it nothing.
//
// Item names are the riskiest part of the job, because acting on one merges
// two rows and that cannot be undone. The prompt is correspondingly strict:
// same object only, and anything with a number in it left alone, because
// "2m Stave" and "2.3m Stave" are different kit that reads as a near-match.
//
// It also proposes CORRECTIONS: a name spelled wrongly with nothing to merge
// it into, and names written against whatever style the rest of the list
// uses. The convention is read off the list rather than imposed — a group
// that writes "Rope, 2m" throughout has a convention, and it is not this
// function's job to decide it should have been "2m rope".
//
// Nothing it returns is trusted: the browser checks every spelling against
// the values that genuinely exist before showing a suggestion, refuses any
// correction that changes a number, and refuses one that lands on a name
// already in use — that would be a merge wearing the word "rename".
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

function buildPrompt(
  locations: Tally[],
  categories: Tally[],
  items: string[],
): string {
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
    "Then do the same for ITEM NAMES: find rows that are the same kit written",
    "two ways — a plural (\"Rope\" and \"Ropes\"), a misspelling (\"malet\" for",
    "\"mallet\"), or the same thing with an extra word.",
    "",
    "ITEM RULES, which are stricter because merging rows cannot be undone:",
    "- Only group names that are the SAME OBJECT. Different sizes, lengths or",
    '  types are different kit: "2m Stave" and "2.3m Stave" are NOT the same,',
    '  nor are "Small Axe" and "Big Axe", nor "Dome Tent" and "Patrol Tent".',
    "- A number anywhere in a name is a strong signal to leave it alone.",
    "- If you are not sure, say nothing. A missed duplicate costs a tidy list;",
    "  a wrong merge destroys a row somebody has to re-enter.",
    "",
    "Then, SEPARATELY, look for values that need CORRECTING rather than",
    "merging — where there is no second spelling to fold them into.",
    "",
    "TWO KINDS OF CORRECTION:",
    "",
    "1. SPELLING. A name that is simply misspelled or mistyped:",
    '   "Tarpaulan" -> "Tarpaulin", "Sleaping bag" -> "Sleeping bag".',
    "   Only when you are confident of the intended word. Scouting words",
    "   you may not know are not misspellings: leave alone anything you",
    "   would only be guessing at.",
    "",
    "2. HOUSE STYLE. Work out how the list is MOSTLY written and bring the",
    "   odd one out into line. Read the convention off the names below —",
    "   do not impose one. Look at how the majority handle capitalisation",
    "   (Sentence case? Title Case?), singular or plural, and where a size",
    "   or colour goes in the name. Only propose a change where the",
    "   majority is clear and one name plainly departs from it.",
    "   If the list has no consistent style, say nothing at all — that is a",
    "   correct answer, and inventing one would rewrite the whole list.",
    "",
    "CORRECTION RULES:",
    "- NEVER change, add or remove a number, a unit or a measurement.",
    '  "2m Stave" may become "2m stave" but never "2.5m Stave" and never',
    '  "Stave".',
    "- Never correct one name to a name already in the list. Two names for",
    "  one thing is a merge, which is the job above.",
    "- Keep it the same thing. Fixing a spelling and matching the style is",
    "  the whole scope; do not make a name more descriptive, more formal, or",
    "  more like what you would have called it.",
    "- Rooms and categories get the same treatment as item names.",
    "- Say nothing rather than something you are unsure of. This list is",
    "  reviewed one line at a time by somebody who has to recognise every",
    "  suggestion as obviously right.",
    "",
    'Reply as JSON: {"findings": [ ... ]} where each finding is either',
    'a grouping: {"kind": "location-variants" | "category-variants" |',
    '"item-variants", "canonical": string, "variants": string[], "why": string}',
    'or a correction: {"kind": "item-rename" | "location-rename" |',
    '"category-rename", "from": string, "to": string, "why": string}',
    '"from" must be a value exactly as it appears in the lists below.',
    '"why" is one short sentence a leader would find obvious, e.g.',
    '"Store Room is misspelled here." or "Everything else is singular."',
    "",
    `ROOMS:\n${list(locations) || "- (none)"}`,
    "",
    `CATEGORIES:\n${list(categories) || "- (none)"}`,
    "",
    `ITEM NAMES:\n${items.map((n) => `- ${JSON.stringify(n)}`).join("\n") || "- (none)"}`,
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

    const { locations, categories, items } = (await req.json()) as {
      locations?: Tally[];
      categories?: Tally[];
      items?: string[];
    };

    const rooms = Array.isArray(locations) ? locations.slice(0, 200) : [];
    const cats = Array.isArray(categories) ? categories.slice(0, 200) : [];
    const names = Array.isArray(items)
      ? items.filter((n): n is string => typeof n === "string").slice(0, 500)
      : [];

    // Nothing to compare against itself.
    if (rooms.length + cats.length + names.length < 2) return json({ findings: [] });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(rooms, cats, names) }] }],
          generationConfig: {
            // This is a matching job, not a writing one.
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
          .slice(0, 40)
      : [];

    return json({ findings });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
