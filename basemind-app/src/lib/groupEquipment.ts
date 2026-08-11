import type { Equipment } from "@/types/database";

export type GroupBy = "location" | "category";

export const UNGROUPED_LABEL = {
  location: "No location set",
  category: "Uncategorised",
} as const;

export type EquipmentGroup = {
  /** Case-folded key used for matching. */
  key: string;
  /** First-seen spelling, shown in the UI. */
  name: string;
  items: Equipment[];
  totalQuantity: number;
  needsAttention: number;
};

function rawValue(item: Equipment, groupBy: GroupBy): string {
  const raw = groupBy === "location" ? item.location : item.category;
  return raw?.trim() ?? "";
}

/**
 * Case-folded bucket key. Entries are free text typed by different people, so
 * "Loft" and "loft" must land in the same room rather than showing up as two.
 */
export function groupKeyFor(item: Equipment, groupBy: GroupBy): string {
  return (rawValue(item, groupBy) || UNGROUPED_LABEL[groupBy]).toLowerCase();
}

/**
 * Buckets items by room or category. Items missing the field land in a single
 * catch-all bucket rather than disappearing from the grouped view.
 */
export function groupEquipment(items: Equipment[], groupBy: GroupBy): EquipmentGroup[] {
  const groups = new Map<string, { name: string; items: Equipment[] }>();

  for (const item of items) {
    const display = rawValue(item, groupBy) || UNGROUPED_LABEL[groupBy];
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
