/**
 * The coloured bands on kit, and what they mean.
 *
 * The 14th's staves and ropes carry a band whose colour encodes LENGTH, so
 * the right one can be pulled off a pile without measuring. That scheme only
 * works if you can see the colour and look up what it means, and until now it
 * was a text column nothing displayed.
 *
 * The index is derived from the inventory rather than written down anywhere:
 * whatever the group is actually banding is what the legend says. A hardcoded
 * table would start out right and drift the first time somebody re-bands the
 * 2m ropes.
 */

/** Something to paint the swatch with, for the colours a group actually uses. */
const SWATCHES: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#eab308",
  orange: "#ea580c",
  pink: "#ec4899",
  purple: "#9333ea",
  brown: "#92400e",
  black: "#171717",
  white: "#fafafa",
  grey: "#737373",
  gray: "#737373",
  silver: "#a3a3a3",
};

/**
 * The CSS colours to paint a band with. Two for "yellow&green", which is a
 * real marking on the 8m ropes rather than a typo.
 */
export function swatchColours(label: string): string[] {
  const parts = label
    .toLowerCase()
    .split(/[&+/,]|\band\b/)
    .map((p) => p.trim())
    .filter(Boolean);

  const known = parts.map((p) => SWATCHES[p]).filter((c): c is string => !!c);
  return known.length > 0 ? known : [];
}

/** Is this something we can draw, rather than just name? */
export function isKnownColour(label: string | null): boolean {
  return !!label && swatchColours(label).length > 0;
}

export type ColourIndexEntry = {
  /** The label as it is written on the items, e.g. "yellow&green". */
  label: string;
  /** CSS colours for the swatch; empty when the name means nothing to us. */
  colours: string[];
  /** How many rows carry this band. */
  items: number;
  /**
   * What this colour is on, in the group's own words.
   *
   * Names are shortened to what distinguishes them, so the legend reads
   * "2m · 4m" rather than repeating "Rope (8mm outdoor braid)" four times.
   */
  examples: string[];
};

/**
 * Builds the legend from the inventory.
 *
 * Ordered by how much kit carries the band, so the colours somebody meets
 * most often are at the top.
 */
export function buildColourIndex(
  equipment: { name: string; label_colour: string | null }[],
): ColourIndexEntry[] {
  const groups = new Map<string, { label: string; names: string[] }>();

  for (const item of equipment) {
    const label = item.label_colour?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const bucket = groups.get(key);
    if (bucket) bucket.names.push(item.name);
    else groups.set(key, { label, names: [item.name] });
  }

  return [...groups.values()]
    .map(({ label, names }) => ({
      label,
      colours: swatchColours(label),
      items: names.length,
      examples: shortestDistinguishing(names),
    }))
    .sort((a, b) => b.items - a.items || a.label.localeCompare(b.label));
}

/**
 * Trims a set of names down to the part that differs.
 *
 * "2m Rope (8mm outdoor braid)" and "4m Rope (8mm outdoor braid)" share
 * everything but the length, and the length is the whole point of the band.
 * With nothing in common the names are left alone.
 */
function shortestDistinguishing(names: string[]): string[] {
  const unique = [...new Set(names)];
  if (unique.length < 2) return unique.slice(0, 4);

  const words = unique.map((n) => n.split(/\s+/));
  // Drop the trailing words every name shares.
  let sharedTail = 0;
  while (
    words.every((w) => w.length > sharedTail + 1) &&
    words.every((w) => w[w.length - 1 - sharedTail] === words[0][words[0].length - 1 - sharedTail])
  ) {
    sharedTail += 1;
  }

  const trimmed = words.map((w) => w.slice(0, w.length - sharedTail).join(" "));
  return [...new Set(trimmed)].slice(0, 4);
}
