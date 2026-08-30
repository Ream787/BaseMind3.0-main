import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useEquipment } from "@/context/EquipmentContext";
import type { Equipment, EquipmentCondition } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
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
  label_colour: string;
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
  label_colour: "",
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
    label_colour: equipment.label_colour ?? "",
  };
}

/** Sentinel for "no colour band on this one". */
const NO_BAND = "__no_band";

/** The colours the swatch can actually draw, plus room for another. */
const BAND_COLOURS = [
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "pink",
  "purple",
  "brown",
  "black",
  "white",
  "grey",
  "yellow&green",
];

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

  useEffect(() => {
    if (open) {
      const start = equipment
        ? toFormState(equipment)
        : { ...emptyForm, location: defaultLocation ?? "" };
      setForm(start);
      setInitial(start);
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
      label_colour: form.label_colour.trim() || null,
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
            p_storage_id: null,
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
              {/* Type to filter, and type something new to create it. The
                  two-state "dropdown or a text box with a Cancel button" this
                  replaces was a worse version of the same idea. */}
              <SearchSelect
                id="eq-category"
                value={form.category || null}
                onChange={(v) => set("category", v)}
                onCreate={(v) => set("category", v)}
                createLabel="New category"
                placeholder="Pick a category"
                searchPlaceholder="Search or type a new one…"
                options={categories.map((c) => ({ value: c, label: c }))}
              />
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
              <SearchSelect
                id="eq-location"
                value={form.location || null}
                onChange={(v) => set("location", v)}
                onCreate={(v) => set("location", v)}
                createLabel="New room"
                placeholder="Pick a room"
                searchPlaceholder="Search or type a new one…"
                options={locations.map((l) => ({ value: l, label: l }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Colour band</Label>
              {/* The whole point of the band scheme, and there was no way to
                  set one: label_colour has been stored since the DELP import
                  and only that import ever filled it in. */}
              <Select
                value={form.label_colour || NO_BAND}
                onValueChange={(v) => set("label_colour", v === NO_BAND ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BAND}>No band</SelectItem>
                  {BAND_COLOURS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
