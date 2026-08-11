import { ChevronRight, DoorOpen, Tags } from "lucide-react";

import type { Equipment } from "@/types/database";
import { groupEquipment, type GroupBy } from "@/lib/groupEquipment";
import { Badge } from "@/components/ui/badge";

interface EquipmentGroupGridProps {
  items: Equipment[];
  groupBy: GroupBy;
  onSelect: (group: { key: string; name: string }) => void;
}

export function EquipmentGroupGrid({ items, groupBy, onSelect }: EquipmentGroupGridProps) {
  const groups = groupEquipment(items, groupBy);
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
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {group.items.length} {group.items.length === 1 ? "item" : "items"}
            </span>
            <span aria-hidden>·</span>
            <span>{group.totalQuantity} total</span>
            {group.needsAttention > 0 && (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
              >
                {group.needsAttention} needs attention
              </Badge>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
