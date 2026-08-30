import { swatchColours } from "@/lib/labelColours";

/**
 * The coloured band on a piece of kit.
 *
 * Split down the middle for a two-colour band like "yellow&green", because
 * that is what is actually wrapped round the rope. The title carries the name
 * as words too: a swatch alone is no use to anyone who cannot tell the
 * group's yellow from its orange, or who is not looking at colour at all.
 */
export function ColourSwatch({ label }: { label: string | null }) {
  if (!label?.trim()) return null;
  const colours = swatchColours(label);
  if (colours.length === 0) return null;

  return (
    <span
      title={`${label} band`}
      aria-label={`${label} band`}
      className="inline-flex size-3 shrink-0 overflow-hidden rounded-full border border-foreground/20 align-middle"
    >
      {colours.map((colour, i) => (
        <span key={i} className="h-full flex-1" style={{ backgroundColor: colour }} />
      ))}
    </span>
  );
}
