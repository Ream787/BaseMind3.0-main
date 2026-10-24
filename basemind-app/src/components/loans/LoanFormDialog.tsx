import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useRoomLabels } from "@/lib/useRoomLabels";
import { availableQuantity, todayISO } from "@/lib/loans";
import type { Equipment, EquipmentLoan } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/** One line of the loan: a thing, and how many of it. */
export type LoanLine = { equipment_id: string; quantity: string };

type FormState = {
  /**
   * What is going out. A loan row in the database is still one item, but a
   * person borrowing four things is one conversation, not four — so the form
   * takes a basket and writes a row for each.
   *
   * Editing works on a single existing row, so the basket holds exactly one.
   */
  lines: LoanLine[];
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
    lines: [{ equipment_id: equipmentId, quantity: "1" }],
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
  const { roomLabel } = useRoomLabels(open);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Snapshot of the form as opened, so "has anything been typed" is a
  // comparison rather than a guess.
  const [initial, setInitial] = useState<FormState | null>(null);
  const dirty = initial !== null && JSON.stringify(form) !== JSON.stringify(initial);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    const start: FormState =
      editing
        ? {
            lines: [
              { equipment_id: editing.equipment_id, quantity: String(editing.quantity) },
            ],
            borrower_name: editing.borrower_name,
            scout_group: editing.scout_group ?? "",
            position: editing.position ?? "",
            phone: editing.phone ?? "",
            email: editing.email ?? "",
            borrowed_on: editing.borrowed_on,
            due_back: editing.due_back ?? "",
            notes: editing.notes ?? "",
          }
        : emptyForm(presetEquipmentId);
    setForm(start);
    setInitial(start);
  }, [open, editing, presetEquipmentId]);

  const scoutGroups = useMemo(
    () =>
      Array.from(
        new Set(loans.map((l) => l.scout_group).filter((g): g is string => !!g?.trim())),
      ).sort(),
    [loans],
  );

  /**
   * How many of an item could go out right now.
   *
   * When editing, this loan's own units are already counted as out, so they
   * are added back — otherwise the form refuses a quantity it accepted five
   * minutes ago.
   */
  function freeCount(item: Equipment): number {
    return (
      availableQuantity(item, loans) +
      (editing && !editing.returned_on && editing.equipment_id === item.id
        ? editing.quantity
        : 0)
    );
  }

  const chosen = new Set(form.lines.map((l) => l.equipment_id).filter(Boolean));

  function setLine(index: number, patch: Partial<LoanLine>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, { equipment_id: "", quantity: "1" }] }));
  }

  function removeLine(index: number) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  }

  /**
   * Just sets the name.
   *
   * It used to look the name up among past borrowers and copy their phone,
   * email, group and position across. That quietly turned the loan history
   * into a contact book that suggested people's details to anyone opening
   * the form, so it is gone: what gets stored is only what is typed now.
   */
  function applyBorrower(name: string) {
    setForm((prev) => ({ ...prev, borrower_name: name }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const lines = form.lines.filter((l) => l.equipment_id);
    if (lines.length === 0) {
      setFormError("Choose at least one thing to lend.");
      return;
    }

    // Everything is checked before anything is written. Half a loan saved,
    // with the other half refused, is worse than a clear refusal.
    for (const line of lines) {
      const item = equipment.find((e) => e.id === line.equipment_id);
      const quantity = Number(line.quantity) || 0;
      if (!item) continue;
      if (quantity < 1) {
        setFormError(`How many ${item.name}? It needs to be at least 1.`);
        return;
      }
      const free = freeCount(item);
      if (quantity > free) {
        setFormError(
          `Only ${free} of ${item.quantity} ${item.name} ${
            free === 1 ? "is" : "are"
          } available — the rest are already out.`,
        );
        return;
      }
    }
    if (form.due_back && form.due_back < form.borrowed_on) {
      setFormError("The return date can't be before the borrow date.");
      return;
    }

    setFormError(null);
    setSubmitting(true);

    const shared = {
      borrower_name: form.borrower_name.trim(),
      scout_group: form.scout_group.trim() || null,
      position: form.position.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      borrowed_on: form.borrowed_on,
      due_back: form.due_back || null,
      notes: form.notes.trim() || null,
    };

    // A loan row is still one item. Several things going out together are
    // several rows sharing a borrower, which keeps returning one of them
    // independent of the rest.
    const { error } = editing
      ? await supabase
          .from("equipment_loans")
          .update({
            ...shared,
            equipment_id: lines[0].equipment_id,
            quantity: Number(lines[0].quantity) || 1,
            returned_on: editing.returned_on ?? null,
          })
          .eq("id", editing.id)
      : await supabase.from("equipment_loans").insert(
          lines.map((line) => ({
            ...shared,
            equipment_id: line.equipment_id,
            quantity: Number(line.quantity) || 1,
            returned_on: null,
          })),
        );

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      editing
        ? "Loan updated"
        : `${shared.borrower_name} has ${lines.length} ${
            lines.length === 1 ? "thing" : "things"
          }`,
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A tap outside used to close this and lose everything typed. On a
          phone that is a miss, not a decision. Once something has been
          entered, only Cancel, Escape or saving closes it. */}
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          if (dirty) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{editing ? "Edit loan" : "Lend equipment"}</DialogTitle>
          <DialogDescription>
            Record who has it and when it&apos;s due back.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{editing ? "Item" : "What's going out"}</Label>

            {form.lines.map((line, index) => {
              const item = equipment.find((e) => e.id === line.equipment_id) ?? null;
              const free = item ? freeCount(item) : 0;
              return (
                <div key={index} className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    {/* Searchable: a Select is unusable once the inventory is
                        a couple of hundred rows and you are standing in the
                        store trying to find one of them. */}
                    <SearchSelect
                      className="flex-1"
                      value={line.equipment_id || null}
                      onChange={(v) => setLine(index, { equipment_id: v })}
                      placeholder="Choose equipment…"
                      searchPlaceholder="Search the inventory…"
                      emptyText="Nothing by that name"
                      options={equipment.map((e) => {
                        const n = freeCount(e);
                        return {
                          value: e.id,
                          label: e.name,
                          hint: n === 0 ? "all out" : `${n} free`,
                          // Already in this basket, or nothing left to lend.
                          disabled:
                            (n === 0 && !editing) ||
                            (e.id !== line.equipment_id && chosen.has(e.id)),
                        };
                      })}
                    />
                    <Input
                      type="number"
                      min={1}
                      max={free || undefined}
                      aria-label="How many"
                      className="w-20"
                      required
                      value={line.quantity}
                      onChange={(e) => setLine(index, { quantity: e.target.value })}
                    />
                    {form.lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove this item"
                        onClick={() => removeLine(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                  {item && (
                    <p className="text-xs text-muted-foreground">
                      {free} of {item.quantity} available · kept in {roomLabel(item.id)}
                    </p>
                  )}
                </div>
              );
            })}

            {/* One borrower, several things: lending a tent, a stove and four
                staves is one conversation, and making it four trips through
                this form is how the last two never get recorded. */}
            {!editing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={addLine}
              >
                <Plus className="size-4" />
                Something else
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-borrower">Borrower</Label>
            {/* No suggestions here on purpose. Offering past borrowers'
                names showed one person's details to whoever opened the form
                next, which is not something a kit list should do. */}
            <Input
              id="loan-borrower"
              required
              autoComplete="off"
              placeholder="Full name"
              value={form.borrower_name}
              onChange={(e) => applyBorrower(e.target.value)}
            />
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
                autoComplete="off"
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
                autoComplete="off"
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
            <Button
              type="submit"
              disabled={submitting || !form.lines.some((l) => l.equipment_id)}
            >
              {submitting ? "Saving…" : editing ? "Save changes" : "Lend it"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
