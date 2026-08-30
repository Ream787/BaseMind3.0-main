import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useEquipment } from "@/context/EquipmentContext";
import type { Equipment, EquipmentCondition } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface UserOption {
  id: string;
  name: string;
}

interface FormState {
  name: string;
  category: string;
  quantity: string;
  location: string;
  condition: EquipmentCondition;
  notes: string;
  date_last_checked: string;
  next_check_date: string;
  checked_by: string;
}

const emptyForm: FormState = {
  name: "",
  category: "",
  quantity: "1",
  location: "",
  condition: "Good",
  notes: "",
  date_last_checked: "",
  next_check_date: "",
  checked_by: "",
};

function toFormState(equipment: Equipment): FormState {
  return {
    name: equipment.name,
    category: equipment.category ?? "",
    quantity: String(equipment.quantity),
    location: equipment.location,
    condition: equipment.condition,
    notes: equipment.notes ?? "",
    date_last_checked: equipment.date_last_checked ?? "",
    next_check_date: equipment.next_check_date ?? "",
    checked_by: equipment.checked_by ?? "",
  };
}

/** Sentinel for the "somewhere new" choice in the room dropdown. */
const NEW_ROOM = "__new_room";

interface EquipmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  categories: string[];
  locations: string[];
  users: UserOption[];
  /**
   * The room to start in when adding.
   *
   * Set when a room is open, so adding kit while standing in the container
   * files it in the container instead of asking where it is.
   */
  defaultLocation?: string;
}

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
  categories,
  locations,
  users,
  defaultLocation,
}: EquipmentFormDialogProps) {
  const { addEquipment, updateEquipment } = useEquipment();
  const [form, setForm] = useState<FormState>(emptyForm);
  // What the form looked like when it opened, so "has anything been typed"
  // is a comparison rather than a guess.
  const [initial, setInitial] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // True while typing a room that doesn't exist yet.
  const [newRoom, setNewRoom] = useState(false);

  useEffect(() => {
    if (open) {
      const start = equipment
        ? toFormState(equipment)
        : { ...emptyForm, location: defaultLocation ?? "" };
      setForm(start);
      setInitial(start);
      setNewRoom(false);
    }
  }, [open, equipment, defaultLocation]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      quantity: Number(form.quantity) || 0,
      location: form.location.trim(),
      condition: form.condition,
      notes: form.notes.trim() || null,
      date_last_checked: form.date_last_checked || null,
      next_check_date: form.next_check_date || null,
      checked_by: form.checked_by || null,
    };

    try {
      if (equipment) {
        await updateEquipment(equipment.id, payload);
        toast.success(`${payload.name} updated`);
      } else {
        const created = await addEquipment(payload);
        // File the new item in the room that was chosen, so it appears there
        // straight away rather than sitting under "not placed" waiting for
        // somebody to notice. Where things are lives in placements now; this
        // form's Room field is the answer to "where does it go to start with".
        if (created && payload.location && payload.quantity > 0) {
          const { error } = await supabase.rpc("place_equipment", {
            p_equipment_id: created.id,
            p_box_id: null,
            p_location: payload.location,
            p_quantity: payload.quantity,
          });
          // The item exists and is correct; only its filing failed.
          if (error) toast.error(`Added, but couldn't file it: ${error.message}`);
        }
        toast.success(`${payload.name} added`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A tap just outside the dialog used to close it and throw away
          everything typed. On a phone that is a miss, not a decision — the
          form is most of the screen and the margin around it is thin. Once
          something has been entered, only Cancel, Escape or saving closes
          it; an untouched form still closes on a tap, because there is
          nothing to lose. */}
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onInteractOutside={(e) => {
          if (dirty) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{equipment ? "Edit equipment" : "Add equipment"}</DialogTitle>
          <DialogDescription>
            {equipment ? "Update the details for this item." : "Add a new item to the inventory."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="eq-name">Name</Label>
              <Input
                id="eq-name"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="eq-category">Category</Label>
              <Input
                id="eq-category"
                list="eq-category-options"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              />
              <datalist id="eq-category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="eq-quantity">Quantity</Label>
              <Input
                id="eq-quantity"
                type="number"
                min={0}
                required
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="eq-location">Room</Label>
              {/* A list of the rooms that exist, rather than a free text box.
                  Typing the room every time is how "Store Room", "store room"
                  and "Strore Room" all end up in the same inventory. Adding a
                  genuinely new one is still one tap away. */}
              {newRoom || locations.length === 0 ? (
                <div className="flex gap-2">
                  <Input
                    id="eq-location"
                    required
                    autoFocus={newRoom}
                    placeholder="New room name"
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                  />
                  {locations.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNewRoom(false);
                        set("location", defaultLocation ?? locations[0]);
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              ) : (
                <Select
                  value={form.location || undefined}
                  onValueChange={(v) => {
                    if (v === NEW_ROOM) {
                      setNewRoom(true);
                      set("location", "");
                    } else {
                      set("location", v);
                    }
                  }}
                >
                  <SelectTrigger id="eq-location">
                    <SelectValue placeholder="Pick a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_ROOM}>+ Somewhere new…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={(v) => set("condition", v as EquipmentCondition)}>
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
              <Label>Checked by</Label>
              <Select
                value={form.checked_by || "__none"}
                onValueChange={(v) => set("checked_by", v === "__none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="eq-last-checked">Last checked</Label>
              <Input
                id="eq-last-checked"
                type="date"
                value={form.date_last_checked}
                onChange={(e) => set("date_last_checked", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="eq-next-check">Next check due</Label>
              <Input
                id="eq-next-check"
                type="date"
                value={form.next_check_date}
                onChange={(e) => set("next_check_date", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="eq-notes">Notes</Label>
              <Textarea
                id="eq-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : equipment ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
