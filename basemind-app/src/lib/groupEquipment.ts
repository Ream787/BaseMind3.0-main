import type { Equipment } from "@/types/database";

export type GroupBy = "room" | "category";

export const UNGROUPED_LABEL = {
  room: "No room set",
  category: "Uncategorised",
} as const;

export type EquipmentGroup = {
  /**
   * The bucket's identity. A room's id in the room view, a case-folded
   * category name in the category view.
   */
  key: string;
  /** What to show for it. */
  name: string;
  items: Equipment[];
  totalQuantity: number;
  needsAttention: number;
};

/**
 * Case-folded category key. Categories are still free text typed by
 * different people, so "Pioneering" and "pioneering" must land in one
 * bucket rather than showing up as two.
 *
 * Rooms used to need the same treatment and no longer do: they are rows in
 * public.rooms with a unique name, so a room's identity is its id.
 */
export function categoryKeyFor(item: Equipment): string {
  return (item.category?.trim() || UNGROUPED_LABEL.category).toLowerCase();
}

/**
 * Buckets items by category. Items with no category land in a single
 * catch-all bucket rather than disappearing from the grouped view.
 *
 * There is no equivalent for rooms, and cannot be: where a thing is lives
 * in its placements, and one item can be in two rooms at once, which is
 * precisely what bucketing by a column on the item cannot say. The room
 * view builds its own groups from placements and passes them in.
 */
export function groupByCategory(
  items: Equipment[],
  /**
   * Buckets to show even when nothing is in them yet.
   *
   * A room earns its place by holding a box, not only by holding loose kit:
   * a brand new box in the container, with nothing in it so far, is exactly
   * the box someone is about to go and fill.
   */
  alwaysShow: { key: string; name: string }[] = [],
): EquipmentGroup[] {
  const groups = new Map<string, { name: string; items: Equipment[] }>();

  for (const extra of alwaysShow) {
    if (!groups.has(extra.key)) groups.set(extra.key, { name: extra.name, items: [] });
  }

  for (const item of items) {
    const display = item.category?.trim() || UNGROUPED_LABEL.category;
    const key = display.toLowerCase();
    const bucket = groups.get(key);
    if (bucket) {
      bucket.items.push(item);
    } else {
      groups.set(key, { name: display, items: [item] });
    }
  }

  return [...groups.entries()]
    .map(([key, { name, items: groupItems }]) => ({
      key,
      name,
      items: groupItems,
      totalQuantity: groupItems.reduce((sum, i) => sum + i.quantity, 0),
      needsAttention: groupItems.filter((i) => i.condition !== "Good").length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
