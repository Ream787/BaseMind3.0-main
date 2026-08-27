/**
 * Finding the mess that creeps into a hand-kept inventory.
 *
 * Two kinds of finding, deliberately kept apart:
 *
 *   EXACT      computed here, from the rows themselves. Two items with the
 *              same name in the same place is a fact, not an opinion, and
 *              it needs no model to spot. These always appear, even when
 *              the assistant is switched off or out of quota.
 *
 *   SUGGESTED  from the model, for the judgement calls — is "Strore Room"
 *              the same place as "Store Room"? Is "malet" a typo? That is
 *              genuinely hard to compute and genuinely easy to read.
 *
 * Nothing the model says is trusted. Every id it returns is checked against
 * the real inventory and every value it claims to have seen must actually be
 * there; anything that doesn't check out is dropped rather than shown. A
 * suggestion to rename a room that doesn't exist is worse than no suggestion,
 * because it looks like it knows something you don't.
 */
import type { Equipment } from "@/types/database";

export type DuplicateFinding = {
  kind: "duplicate";
  /** Same name, same place — the rows are almost certainly one thing. */
  itemIds: string[];
  name: string;
  location: string;
};

export type VariantFinding = {
  kind: "location-variants" | "category-variants";
  /** The spelling to keep, always one that already exists in the data. */
  canonical: string;
  /** The other spellings of it, also all real values. */
  variants: string[];
  /** How many rows would be renamed. */
  affected: number;
  why: string;
};

export type Finding = DuplicateFinding | VariantFinding;

const norm = (v: string | null) => (v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Items that share a name AND a place.
 *
 * The same name in two different rooms is left alone on purpose: a group
 * genuinely has a first aid kit in the store and another in the minibus, and
 * calling that a duplicate would train people to ignore this list.
 */
export function findDuplicates(equipment: Equipment[]): DuplicateFinding[] {
  const groups = new Map<string, Equipment[]>();

  for (const item of equipment) {
    const key = `${norm(item.name)}@@${norm(item.location)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const findings: DuplicateFinding[] = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    findings.push({
      kind: "duplicate",
      itemIds: rows.map((r) => r.id),
      name: rows[0].name,
      location: rows[0].location,
    });
  }
  return findings.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Spellings of a room or category that differ only by case or spacing.
 *
 * Computed rather than asked, because "Store Room" and "store  room" being
 * the same place isn't a judgement call. The most-used spelling wins, since
 * that is the one people are actually typing.
 */
export function findCasingVariants(
  equipment: Equipment[],
  field: "location" | "category",
): VariantFinding[] {
  const byNormalised = new Map<string, Map<string, number>>();

  for (const item of equipment) {
    const raw = field === "location" ? item.location : item.category;
    if (!raw?.trim()) continue;
    const key = norm(raw);
    const spellings = byNormalised.get(key) ?? new Map<string, number>();
    spellings.set(raw, (spellings.get(raw) ?? 0) + 1);
    byNormalised.set(key, spellings);
  }

  const findings: VariantFinding[] = [];
  for (const spellings of byNormalised.values()) {
    if (spellings.size < 2) continue;
    // Most-used spelling wins, since that is the one people actually type.
    // On a tie, prefer the one that looks like a proper name: with one
    // "Loft" and one "loft", suggesting the rename the other way round
    // reads as a downgrade and nobody would accept it.
    const capitals = (value: string) => (value.match(/[A-Z]/g) ?? []).length;
    const ranked = [...spellings.entries()].sort(
      (a, b) =>
        b[1] - a[1] || capitals(b[0]) - capitals(a[0]) || a[0].localeCompare(b[0]),
    );
    const [canonical] = ranked[0];
    const variants = ranked.slice(1).map(([spelling]) => spelling);
    findings.push({
      kind: field === "location" ? "location-variants" : "category-variants",
      canonical,
      variants,
      affected: ranked.slice(1).reduce((sum, [, count]) => sum + count, 0),
      why: "Same wording, different capitalisation or spacing.",
    });
  }
  return findings;
}

/** Everything that can be found without asking a model. */
export function findExactProblems(equipment: Equipment[]): Finding[] {
  return [
    ...findDuplicates(equipment),
    ...findCasingVariants(equipment, "location"),
    ...findCasingVariants(equipment, "category"),
  ];
}

/** What the model is asked to return. Shapes are not trusted. */
export type RawFinding = {
  kind?: string;
  canonical?: string;
  variants?: unknown;
  why?: string;
};

/**
 * Checks the model's suggestions against the real inventory.
 *
 * A suggestion survives only if the spelling to keep and every spelling to
 * replace are values that genuinely appear in the data, and the two are
 * actually different. That rules out the two ways this goes wrong in
 * practice: inventing a tidier name nobody uses, and "correcting" something
 * to what it already says.
 */
export function verifyFindings(
  raw: RawFinding[],
  equipment: Equipment[],
  already: Finding[],
): VariantFinding[] {
  const counts = {
    location: new Map<string, number>(),
    category: new Map<string, number>(),
  };
  for (const item of equipment) {
    for (const field of ["location", "category"] as const) {
      const value = field === "location" ? item.location : item.category;
      if (value?.trim()) counts[field].set(value, (counts[field].get(value) ?? 0) + 1);
    }
  }

  // Don't repeat something the exact pass already found.
  const seen = new Set(
    already
      .filter((f): f is VariantFinding => f.kind !== "duplicate")
      .flatMap((f) => f.variants.map((v) => norm(v))),
  );

  const out: VariantFinding[] = [];

  for (const finding of Array.isArray(raw) ? raw : []) {
    // Reaching in without checking is how this crashes on a null in the
    // array. The model's reply is the one input here that is allowed to be
    // any shape at all, so nothing about it can be assumed.
    if (!finding || typeof finding !== "object") continue;

    const field =
      finding.kind === "location-variants"
        ? "location"
        : finding.kind === "category-variants"
          ? "category"
          : null;
    if (!field) continue;

    const canonical = typeof finding.canonical === "string" ? finding.canonical.trim() : "";
    if (!canonical || !counts[field].has(canonical)) continue;

    const variants = Array.isArray(finding.variants)
      ? finding.variants.filter(
          (v): v is string =>
            typeof v === "string" &&
            counts[field].has(v.trim()) &&
            norm(v) !== norm(canonical) &&
            !seen.has(norm(v)),
        )
      : [];
    if (variants.length === 0) continue;

    for (const v of variants) seen.add(norm(v));

    out.push({
      kind: field === "location" ? "location-variants" : "category-variants",
      canonical,
      variants: variants.map((v) => v.trim()),
      affected: variants.reduce((sum, v) => sum + (counts[field].get(v.trim()) ?? 0), 0),
      why: (finding.why ?? "").trim() || "Looks like the same place spelled differently.",
    });
  }

  return out;
}

/** A short, plain description of what applying a finding would do. */
export function describeFix(finding: Finding): string {
  if (finding.kind === "duplicate") {
    return `Merge ${finding.itemIds.length} rows into one, adding their quantities together.`;
  }
  const list = finding.variants.map((v) => `"${v}"`).join(", ");
  const noun = finding.kind === "location-variants" ? "item" : "item";
  return `Rename ${list} to "${finding.canonical}" on ${finding.affected} ${noun}${
    finding.affected === 1 ? "" : "s"
  }.`;
}
