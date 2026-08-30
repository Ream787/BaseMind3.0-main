/**
 * Finding the mess that creeps into a hand-kept inventory.
 *
 * Two kinds of finding, deliberately kept apart:
 *
 *   EXACT      computed here, from the rows themselves. Two rows sharing a
 *              name is a fact, not an opinion, and needs no model to spot.
 *              These always appear, even when the assistant is switched off
 *              or out of quota.
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
  /** Rows sharing a name: almost certainly one thing entered more than once. */
  itemIds: string[];
  name: string;
  /** Where those rows currently say they are, for the description. */
  locations: string[];
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

/**
 * Two rows that are the same kit under different names — "Rope" and "Ropes",
 * "Mallet" and "Frapping malet".
 *
 * Worth acting on now in a way it wasn't before: merging used to force the
 * result into one room, so a Rope in the loft and Ropes in the container
 * could not be reconciled without losing something. Placements mean the
 * merged row keeps both, so the only thing lost is the duplicate name.
 */
export type ItemVariantFinding = {
  kind: "item-variants";
  /** The name to keep, and the row that already carries it. */
  canonical: string;
  canonicalId: string;
  /** The rows to merge into it. */
  variants: { id: string; name: string }[];
  why: string;
};

export type Finding = DuplicateFinding | VariantFinding | ItemVariantFinding;

const norm = (v: string | null) => (v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Items that share a name, wherever they are.
 *
 * This used to require the same room as well, on the reasoning that a first
 * aid kit in the store and another in the minibus are two real things and
 * flagging them would train people to ignore this list. That reasoning was
 * right when merging forced the result into one room — it would have thrown
 * away where half the kit was.
 *
 * Placements changed it. One row can now be in the store AND the minibus
 * with a count for each, so merging keeps everything and the duplicate rows
 * were only ever a workaround for the model that could not express it. Three
 * rows called "Tents" in three rooms is one kind of tent in three rooms.
 */
export function findDuplicates(equipment: Equipment[]): DuplicateFinding[] {
  const groups = new Map<string, Equipment[]>();

  for (const item of equipment) {
    const key = norm(item.name);
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
      locations: [...new Set(rows.map((r) => r.location).filter(Boolean))],
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
      .filter(
        (f): f is VariantFinding =>
          f.kind === "location-variants" || f.kind === "category-variants",
      )
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

/**
 * Checks the model's item-name suggestions against the real inventory.
 *
 * Every name has to belong to a row that exists, the names must differ, and
 * a row may only be merged away once — the model happily suggests chains like
 * "Rope -> Ropes" and "Ropes -> Rope" given the chance, and applying both
 * would delete the survivor.
 */
export function verifyItemFindings(
  raw: RawFinding[],
  equipment: { id: string; name: string }[],
): ItemVariantFinding[] {
  const byName = new Map<string, { id: string; name: string }>();
  for (const item of equipment) {
    // First row wins a name, so two rows sharing one are handled by the
    // exact duplicate pass rather than here.
    if (!byName.has(norm(item.name))) byName.set(norm(item.name), item);
  }

  const spokenFor = new Set<string>();
  const out: ItemVariantFinding[] = [];

  for (const finding of Array.isArray(raw) ? raw : []) {
    if (!finding || typeof finding !== "object") continue;
    if (finding.kind !== "item-variants") continue;

    const canonicalName = typeof finding.canonical === "string" ? finding.canonical.trim() : "";
    const canonical = byName.get(norm(canonicalName));
    if (!canonical || spokenFor.has(canonical.id)) continue;

    const variants = (Array.isArray(finding.variants) ? finding.variants : [])
      .filter((v): v is string => typeof v === "string")
      .map((v) => byName.get(norm(v)))
      .filter(
        (v): v is { id: string; name: string } =>
          !!v && v.id !== canonical.id && !spokenFor.has(v.id),
      );

    if (variants.length === 0) continue;

    spokenFor.add(canonical.id);
    for (const v of variants) spokenFor.add(v.id);

    out.push({
      kind: "item-variants",
      canonical: canonical.name,
      canonicalId: canonical.id,
      variants: variants.map((v) => ({ id: v.id, name: v.name })),
      why: (finding.why ?? "").trim() || "Looks like the same kit under two names.",
    });
  }

  return out;
}

/** A short, plain description of what applying a finding would do. */
export function describeFix(finding: Finding): string {
  if (finding.kind === "duplicate") {
    const where =
      finding.locations.length > 1 ? ` across ${finding.locations.join(", ")}` : "";
    return (
      `Merge ${finding.itemIds.length} rows${where} into one. Quantities add up, ` +
      "and every room and box each row was in is kept."
    );
  }
  if (finding.kind === "item-variants") {
    const names = finding.variants.map((v) => `"${v.name}"`).join(", ");
    return `Merge ${names} into "${finding.canonical}". Quantities add up and every room and box each was in is kept.`;
  }
  const list = finding.variants.map((v) => `"${v}"`).join(", ");
  const noun = finding.kind === "location-variants" ? "item" : "item";
  return `Rename ${list} to "${finding.canonical}" on ${finding.affected} ${noun}${
    finding.affected === 1 ? "" : "s"
  }.`;
}
