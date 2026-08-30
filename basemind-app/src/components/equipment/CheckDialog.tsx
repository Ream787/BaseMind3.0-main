import { useEffect, useState, type FormEvent } from "react";
import { addMonths, format } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useEquipment } from "@/context/EquipmentContext";
import type { Equipment, EquipmentCondition } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const CONDITIONS: EquipmentCondition[] = ["Good", "Needs Repair", "Broken", "Missing"];

/** How long a check is good for. */
export const MONTHS_UNTIL_NEXT_CHECK = 6;

/**
 * Recording a check, with room to say what you saw.
 *
 * The note is the point. "Two pegs bent", "zip sticking but usable" is
 * exactly what gets noticed with the kit in your hands and forgotten by the
 * next person to look — and it is not a condition, so there was nowhere to
 * put it.
 *
 * Everything except the note is already filled in, so a check with nothing
 * to say is still one tap on Checked.
 */
export function CheckDialog({
  item,
  onOpenChange,
}: {
  item: Equipment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile } = useAuth();
  const { updateEquipment } = useEquipment();
  const [note, setNote] = useState("");
  const [condition, setCondition] = useState<EquipmentCondition>("Good");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setNote("");
      setCondition(item.condition);
    }
  }, [item]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    setSaving(true);
    const today = new Date();
    const nextDue = addMonths(today, MONTHS_UNTIL_NEXT_CHECK);

    try {
      await updateEquipment(item.id, {
        condition,
        date_last_checked: format(today, "yyyy-MM-dd"),
        next_check_date: format(nextDue, "yyyy-MM-dd"),
        checked_by: profile?.id ?? null,
      });

      // The log is written second: the summary on the item is what the rest
      // of the app reads, so if only one of the two can land, that one
      // matters more.
      const { error } = await supabase.from("equipment_checks").insert({
        equipment_id: item.id,
        checked_by: profile?.id ?? null,
        note: note.trim() || null,
        condition,
      });
      if (error) toast.error(`Checked, but the note wasn't saved: ${error.message}`);
      else {
        toast.success(`${item.name} checked — next check ${format(nextDue, "d MMM yyyy")}`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record that check.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => {
          if (note.trim()) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Check {item?.name}</DialogTitle>
          <DialogDescription>
            Records today, you, and the next check in {MONTHS_UNTIL_NEXT_CHECK} months.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>How is it?</Label>
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v as EquipmentCondition)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="check-note">Note (optional)</Label>
            <Textarea
              id="check-note"
              rows={3}
              placeholder="Anything worth telling the next person…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Checked
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
