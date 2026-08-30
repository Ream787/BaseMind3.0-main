/**
 * Filing policy documents onto labelled shelves.
 *
 * The categories are a fixed list rather than whatever the model thinks of.
 * Left to invent them it produces "Safety", "Safeguarding" and "Child Safety"
 * as three separate shelves, which is worse than no grouping at all.
 *
 * Nothing the model returns is trusted: a title has to match a document that
 * exists, and a category has to be one of these. Anything else is dropped
 * rather than applied, because a document filed under a shelf nobody can see
 * is a document that has gone missing.
 */
import type { Policy } from "@/types/database";

export const POLICY_CATEGORIES = [
  "Safety",
  "Young people",
  "Activities",
  "Camping",
  "Transport",
  "Money",
  "Running the group",
  "Other",
] as const;

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

/** Where "Other" and anything unfiled sorts to: the bottom. */
const ORDER = new Map<string, number>(POLICY_CATEGORIES.map((c, i) => [c, i]));

const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

export type RawFiling = { title?: unknown; category?: unknown };

export type Filing = {
  policyId: string;
  title: string;
  category: PolicyCategory;
  /** What it was filed under before, so the change can be described. */
  previous: string | null;
};

/**
 * Checks the model's filing against the real shelf.
 *
 * Only documents that exist, only categories from the list, and only where
 * the category would actually change something — re-filing a document to
 * where it already is is not a suggestion, it is noise.
 */
export function verifyFilings(raw: RawFiling[], policies: Policy[]): Filing[] {
  const byTitle = new Map<string, Policy>();
  for (const policy of policies) {
    if (!byTitle.has(norm(policy.title))) byTitle.set(norm(policy.title), policy);
  }

  const valid = new Set<string>(POLICY_CATEGORIES);
  const seen = new Set<string>();
  const out: Filing[] = [];

  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.title !== "string" || typeof item.category !== "string") continue;

    const policy = byTitle.get(norm(item.title));
    if (!policy || seen.has(policy.id)) continue;

    const category = item.category.trim();
    if (!valid.has(category)) continue;
    if (norm(policy.category ?? "") === norm(category)) continue;

    seen.add(policy.id);
    out.push({
      policyId: policy.id,
      title: policy.title,
      category: category as PolicyCategory,
      previous: policy.category,
    });
  }

  return out;
}

export type PolicyGroup = { category: string; policies: Policy[] };

/**
 * Groups the shelf for display.
 *
 * Known categories keep the order they are listed in, which runs roughly from
 * "someone could get hurt" to "paperwork". Anything else — a category typed by
 * hand before this existed — sorts after them alphabetically, and unfiled
 * documents come last, because they are the ones needing attention.
 */
export function groupPolicies(policies: Policy[]): PolicyGroup[] {
  const groups = new Map<string, Policy[]>();

  for (const policy of policies) {
    const key = policy.category?.trim() || "Not filed";
    const bucket = groups.get(key);
    if (bucket) bucket.push(policy);
    else groups.set(key, [policy]);
  }

  return [...groups.entries()]
    .map(([category, list]) => ({
      category,
      policies: [...list].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category));
}

function rank(category: string): number {
  if (category === "Not filed") return ORDER.size + 1;
  return ORDER.get(category) ?? ORDER.size;
}
