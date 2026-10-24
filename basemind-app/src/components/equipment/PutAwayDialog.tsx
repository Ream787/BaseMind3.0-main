import { useState } from "react";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import type { StrayLoose } from "@/lib/placements";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

/**
 * Clearing up kit that is filed loose in a room and in a box in that room.
 *
 * Putting something in a box used to leave the room's pile where it was, so
 * stores packed months ago still list everything as loose. This moves the
 * loose units into the place that already holds most of that item.
 *
 * It moves rather than deletes, deliberately: the counts are the record of
 * what the group owns, and quietly dropping two mallets to tidy a list would
 * be a worse bug than the one being fixed. Everything here is undone by
 * typing a number back into the box.
 */
export function PutAwayDialog({
  open,
  onOpenChange,
  roomName,
  strays,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only shown, never matched on — the strays were found by room id. */
  roomName: string;
  strays: StrayLoose[];
}) {
  const [working, setWorking] = useState(false);

  async function putAway() {
    setWorking(true);
    let moved = 0;
    const failed: string[] = [];

    // One at a time: a single failure should not take the rest with it, and
    // the whole point is to leave the store more correct than it was found.
    for (const stray of strays) {
      const { error } = await supabase.rpc("stow_equipment", {
        p_equipment_id: stray.item.id,
        p_storage_id: stray.place.id,
        p_quantity: stray.loose,
      });
      if (error) failed.push(`${stray.item.name}: ${error.message}`);
      else moved += 1;
    }

    setWorking(false);
    onOpenChange(false);

    if (moved > 0) {
      toast.success(`${moved} ${moved === 1 ? "item" : "items"} put away in ${roomName}`);
    }
    if (failed.length > 0) {
      toast.error(failed[0], {
        description:
          failed.length > 1 ? `and ${failed.length - 1} more couldn't be moved` : undefined,
      });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Put these away?</AlertDialogTitle>
          <AlertDialogDescription>
            Each of these is filed both loose in {roomName} and in something standing in it.
            Where the two are the same kit counted twice, the loose copy goes; where they
            are different kit, it moves in. Either way the room list clears and the number
            the group owns does not change.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="max-h-64 overflow-y-auto rounded-md border text-sm">
          {strays.map((stray) => (
            <li
              key={stray.item.id}
              className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
            >
              <span className="min-w-0 truncate font-medium">{stray.item.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {stray.moving === 0
                  ? `${stray.loose} already counted in ${stray.place.name}`
                  : stray.duplicate === 0
                    ? `${stray.loose} → ${stray.place.name} (has ${stray.inPlace})`
                    : `${stray.duplicate} already counted, ${stray.moving} → ${stray.place.name}`}
              </span>
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={working}>Leave them</AlertDialogCancel>
          <AlertDialogAction disabled={working} onClick={putAway}>
            <PackageCheck className="size-4" />
            {working ? "Putting away…" : `Put away ${strays.length}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
