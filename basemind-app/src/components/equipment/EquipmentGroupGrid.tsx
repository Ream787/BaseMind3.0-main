import { Box, ChevronRight, DoorOpen, Tags } from "lucide-react";

import type { Equipment } from "@/types/database";
import { groupEquipment, type EquipmentGroup, type GroupBy } from "@/lib/groupEquipment";

interface EquipmentGroupGridProps {
  items: Equipment[];
  groupBy: GroupBy;
  onSelect: (group: { key: string; name: string }) => void;
  /** How many boxes each room holds, keyed the same way as the groups. */
  boxCounts?: Map<string, number>;
  /** Rooms to list even with nothing loose in them yet. */
  alwaysShow?: { key: string; name: string }[];
  /**
   * Pre-built buckets, used instead of grouping by a column.
   *
   * The room view is built from placements now: one item can be in two rooms
   * at once, which is precisely what grouping by a single column cannot say.
   */
  groups?: EquipmentGroup[];
}

export function EquipmentGroupGrid({
  items,
  groupBy,
  onSelect,
  boxCounts,
  alwaysShow,
  groups: providedGroups,
}: EquipmentGroupGridProps) {
  const groups = providedGroups ?? groupEquipment(items, groupBy, alwaysShow);
  const Icon = groupBy === "location" ? DoorOpen : Tags;

  if (groups.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No equipment found.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <button
          key={group.key}
          type="button"
          onClick={() => onSelect({ key: group.key, name: group.name })}
          className="group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Icon className="size-4 shrink-0 text-primary" />
              <span className="truncate font-medium">{group.name}</span>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {(boxCounts?.get(group.key) ?? 0) > 0 && (
              <>
                <span className="flex items-center gap-1 text-foreground">
                  <Box className="size-3.5" />
                  {boxCounts?.get(group.key)}{" "}
                  {boxCounts?.get(group.key) === 1 ? "box" : "boxes"}
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>
              {group.items.length} {group.items.length === 1 ? "item" : "items"}
            </span>
            <span aria-hidden>·</span>
            <span>{group.totalQuantity} total</span>
          </div>
        </button>
      ))}
    </div>
  );
}
