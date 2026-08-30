/**
 * Filing policy documents onto labelled shelves.
 *
 * TWO RULES, and both matter more than they look.
 *
 * It only ever touches documents with NO category. A filing that could
 * overwrite one somebody chose is a filing that quietly undoes their work,
 * and there is no way to tell from the outside whether "Safety" was the
 * model's guess last week or a decision this morning. So a document that has
 * been filed is left exactly where it is.
 *
 * A category it proposes may be one already in use or a genuinely new one,
 * but a new one that differs from an existing category only by case or
 * spacing is snapped to the existing spelling. Otherwise a shelf splits into
 * "Safety" and "safety" and neither has everything on it.
 */
import type { Policy } from "@/types/database";

/** Offered as a starting point when nothing has been filed yet. */
export const SUGGESTED_CATEGORIES = [
  "Safety",
  "Young people",
  "Activities",
  "Camping",
  "Transport",
  "Money",
  "Running the group",
] as const;

/** Sort order for the suggested ones; anything else follows them. */
const ORDER = new Map<string, number>(SUGGESTED_CATEGORIES.map((c, i) => [c, i]));

const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();

/** A category name has to be short enough to be a label on a shelf. */
const MAX_CATEGORY_LENGTH = 40;

export type RawFiling = { title?: unknown; category?: unknown };

export type Filing = {
  policyId: string;
  title: string;
  category: string;
  /** True when this shelf doesn't exist yet, so the UI can say so. */
  isNewCategory: boolean;
};

/** Every category currently in use, in the spelling it is written in. */
export function categoriesInUse(policies: Policy[]): string[] {
  const seen = new Map<string, string>();
  for (const policy of policies) {
    const value = policy.category?.trim();
    if (value && !seen.has(norm(value))) seen.set(norm(value), value);
  }
  return [...seen.values()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Documents with nowhere to be: the only ones filing may touch. */
export function unfiled(policies: Policy[]): Policy[] {
  return policies.filter((p) => !p.category?.trim());
}

/**
 * Checks the model's filing against the real shelf.
 *
 * Survives only if: the title is a document that exists, that document has no
 * category yet, and the category is a usable label. Anything else is dropped
 * rather than applied — a document filed onto a shelf nobody can see is a
 * document that has gone missing.
 */
export function verifyFilings(raw: RawFiling[], policies: Policy[]): Filing[] {
  // Only unfiled documents are candidates. Building the index from these
  // alone is what makes overwriting an existing category impossible here,
  // rather than merely unlikely.
  const candidates = new Map<string, Policy>();
  for (const policy of unfiled(policies)) {
    if (!candidates.has(norm(policy.title))) candidates.set(norm(policy.title), policy);
  }

  const existing = new Map<string, string>();
  for (const category of categoriesInUse(policies)) existing.set(norm(category), category);
  for (const category of SUGGESTED_CATEGORIES) {
    if (!existing.has(norm(category))) existing.set(norm(category), category);
  }

  const seen = new Set<string>();
  const out: Filing[] = [];

  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== "object") continue;
    if (typeof item.title !== "string" || typeof item.category !== "string") continue;

    const policy = candidates.get(norm(item.title));
    if (!policy || seen.has(policy.id)) continue;

    const proposed = item.category.replace(/\s+/g, " ").trim();
    if (!proposed || proposed.length > MAX_CATEGORY_LENGTH) continue;

    // Snap to the spelling already in use, so a shelf never splits in two
    // over capitalisation.
    const match = existing.get(norm(proposed));
    const category = match ?? proposed;

    seen.add(policy.id);
    out.push({
      policyId: policy.id,
      title: policy.title,
      category,
      isNewCategory: !match,
    });
    // A brand new shelf becomes an existing one for the rest of this batch.
    if (!match) existing.set(norm(category), category);
  }

  return out;
}

export type PolicyGroup = { category: string; policies: Policy[] };

/**
 * Groups the shelf for display.
 *
 * The suggested categories keep the order they are listed in, which runs
 * roughly from "someone could get hurt" to "paperwork". Categories somebody
 * made up follow them alphabetically, and unfiled documents come last,
 * because those are the ones needing attention.
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
