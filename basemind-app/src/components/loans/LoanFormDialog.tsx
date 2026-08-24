import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { availableQuantity, knownBorrowers, todayISO } from "@/lib/loans";
import type { Equipment, EquipmentLoan } from "@/types/database";
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

/** Common scout positions; free text, so anything else can be typed. */
const POSITION_SUGGESTIONS = [
  "PL",
  "APL",
  "Scout",
  "Scouter",
  "Troop Scouter",
  "Rover",
  "Parent",
];

type FormState = {
  equipment_id: string;
  quantity: string;
  borrower_name: string;
  scout_group: string;
  position: string;
  phone: string;
  email: string;
  borrowed_on: string;
  due_back: string;
  notes: string;
};

function emptyForm(equipmentId = ""): FormState {
  return {
    equipment_id: equipmentId,
    quantity: "1",
    borrower_name: "",
    scout_group: "",
    position: "",
    phone: "",
    email: "",
    borrowed_on: todayISO(),
    due_back: "",
    notes: "",
  };
}

interface LoanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment[];
  loans: EquipmentLoan[];
  /** Pre-selects an item when lending straight from the equipment page. */
  presetEquipmentId?: string;
  editing?: EquipmentLoan | null;
}

export function LoanFormDialog({
  open,
  onOpenChange,
  equipment,
  loans,
  presetEquipmentId,
  editing = null,
}: LoanFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setForm(
      editing
        ? {
            equipment_id: editing.equipment_id,
            quantity: String(editing.quantity),
            borrower_name: editing.borrower_name,
            scout_group: editing.scout_group ?? "",
            position: editing.position ?? "",
            phone: editing.phone ?? "",
            email: editing.email ?? "",
            borrowed_on: editing.borrowed_on,
            due_back: editing.due_back ?? "",
            notes: editing.notes ?? "",
          }
        : emptyForm(presetEquipmentId),
    );
  }, [open, editing, presetEquipmentId]);

  const borrowers = useMemo(() => knownBorrowers(loans), [loans]);
  const scoutGroups = useMemo(
    () =>
      Array.from(
        new Set(loans.map((l) => l.scout_group).filter((g): g is string => !!g?.trim())),
      ).sort(),
    [loans],
  );

  const selectedItem = equipment.find((e) => e.id === form.equipment_id) ?? null;

  // When editing, this loan's own units are already counted as out, so add
  // them back to avoid the form refusing a quantity it previously allowed.
  const available = selectedItem
    ? availableQuantity(selectedItem, loans) + (editing && !editing.returned_on ? editing.quantity : 0)
    : 0;

  /** Filling in a past borrower's name copies their details across. */
  function applyBorrower(name: string) {
    const match = borrowers.find(
      (b) => b.borrower_name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    setForm((prev) => ({
      ...prev,
      borrower_name: name,
      ...(match
        ? {
            scout_group: match.scout_group ?? prev.scout_group,
            position: match.position ?? prev.position,
            phone: match.phone ?? prev.phone,
            email: match.email ?? prev.email,
          }
        : {}),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const quantity = Number(form.quantity) || 0;
    if (quantity < 1) {
      setFormError("Quantity must be at least 1.");
      return;
    }
    if (selectedItem && quantity > available) {
      setFormError(
        `Only ${available} of ${selectedItem.quantity} ${selectedItem.name} ${
          available === 1 ? "is" : "are"
        } available — the rest are already out.`,
      );
      return;
    }
    if (form.due_back && form.due_back < form.borrowed_on) {
      setFormError("The return date can't be before the borrow date.");
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setFormError("Add a phone number or an email so you can chase it up.");
      return;
    }

    setFormError(null);
    setSubmitting(true);

    const payload = {
      equipment_id: form.equipment_id,
      quantity,
      borrower_name: form.borrower_name.trim(),
      scout_group: form.scout_group.trim() || null,
      position: form.position.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      borrowed_on: form.borrowed_on,
      due_back: form.due_back || null,
      notes: form.notes.trim() || null,
      returned_on: editing?.returned_on ?? null,
    };

    const { error } = editing
      ? await supabase.from("equipment_loans").update(payload).eq("id", editing.id)
      : await supabase.from("equipment_loans").insert(payload);

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      editing ? "Loan updated" : `${payload.borrower_name} has ${selectedItem?.name ?? "the item"}`,
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit loan" : "Lend equipment"}</DialogTitle>
          <DialogDescription>
            Record who has it and when it&apos;s due back.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_6rem] gap-4">
            <div className="flex flex-col gap-2">
              <Label>Item</Label>
              <Select
                value={form.equipment_id}
                onValueChange={(v) => setForm({ ...form, equipment_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose equipment…" />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((item) => {
                    const free = availableQuantity(item, loans);
                    return (
                      <SelectItem key={item.id} value={item.id} disabled={free === 0 && !editing}>
                        {item.name} — {free} of {item.quantity} free
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="loan-qty">Quantity</Label>
              <Input
                id="loan-qty"
                type="number"
                min={1}
                max={available || undefined}
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
          </div>
          {selectedItem && (
            <p className="-mt-2 text-xs text-muted-foreground">
              {available} of {selectedItem.quantity} available · kept in {selectedItem.location}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-borrower">Borrower</Label>
            <Input
              id="loan-borrower"
              list="loan-borrower-options"
              required
              placeholder="Full name"
              value={form.borrower_name}
              onChange={(e) => applyBorrower(e.target.value)}
            />
            <datalist id="loan-borrower-options">
              {borrowers.map((b) => (
                <option key={b.id} value={b.borrower_name} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="loan-group">Scout group</Label>
              <Input
                id="loan-group"
                list="loan-group-options"
                value={form.scout_group}
                onChange={(e) => setForm({ ...form, scout_group: e.target.value })}
              />
              <datalist id="loan-group-options">
                {scoutGroups.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="loan-position">Position (optional)</Label>
              <Input
                id="loan-position"
                list="loan-position-options"
                placeholder="PL, Scouter…"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
              <datalist id="loan-position-options">
                {POSITION_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="loan-phone">Phone</Label>
              <Input
                id="loan-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="loan-email">Email</Label>
              <Input
                id="loan-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="loan-borrowed">Borrowed on</Label>
              <Input
                id="loan-borrowed"
                type="date"
                required
                value={form.borrowed_on}
                onChange={(e) => setForm({ ...form, borrowed_on: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="loan-due">Due back</Label>
              <Input
                id="loan-due"
                type="date"
                min={form.borrowed_on || undefined}
                value={form.due_back}
                onChange={(e) => setForm({ ...form, due_back: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-notes">Notes</Label>
            <Textarea
              id="loan-notes"
              placeholder="Condition when it went out, what it's for…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !form.equipment_id}>
              {submitting ? "Saving…" : editing ? "Save changes" : "Lend it"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
