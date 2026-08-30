import { buildColourIndex } from "@/lib/labelColours";
import type { Equipment } from "@/types/database";
import { ColourSwatch } from "@/components/equipment/ColourSwatch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * What the coloured bands mean, read off the inventory itself.
 *
 * Not a written-down table: whatever the group is actually banding is what
 * this says. A fixed legend would be right on the day it was written and
 * wrong the first time somebody re-bands the 2m ropes — which has already
 * happened once here, where the legend said green and the rope says pink.
 */
export function ColourIndexDialog({
  open,
  onOpenChange,
  equipment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment[];
}) {
  const index = buildColourIndex(equipment);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Colour bands</DialogTitle>
          <DialogDescription>
            What each band is on, taken from the inventory as it stands.
          </DialogDescription>
        </DialogHeader>

        {index.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing is banded yet. Set a colour on an item and it appears here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {index.map((entry) => (
              <li
                key={entry.label}
                className="flex items-start gap-3 rounded-lg border bg-card p-3"
              >
                <span className="mt-0.5">
                  <ColourSwatch label={entry.label} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium capitalize">{entry.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {entry.examples.join(" · ")}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.items} {entry.items === 1 ? "kind" : "kinds"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          A band marks length. An item&apos;s own colour — green 8mm braid, red 10mm — is
          its type, not its band, so it isn&apos;t listed here.
        </p>
      </DialogContent>
    </Dialog>
  );
}
