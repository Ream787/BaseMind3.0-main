import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import type { FoodItem } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionTabs, FOOD_TABS } from "@/components/layout/SectionTabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

/** Common units, offered as suggestions but not enforced. */
const UNIT_SUGGESTIONS = ["kg", "g", "litres", "ml", "tins", "packets", "loaves", "units"];

const emptyForm = {
  name: "",
  unit: "units",
  quantity: "0",
  category: "",
  notes: "",
};

export function FoodPage() {
  const { hasRole } = useAuth();
  const { rows: food, loading, error } = useRealtimeTable("food_items", { orderBy: "name" });

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FoodItem | null>(null);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  useEffect(() => {
    if (!dialogOpen) return;
    setForm(
      editing
        ? {
            name: editing.name,
            unit: editing.unit,
            quantity: String(editing.quantity),
            category: editing.category ?? "",
            notes: editing.notes ?? "",
          }
        : emptyForm,
    );
  }, [dialogOpen, editing]);

  const categories = useMemo(
    () => Array.from(new Set(food.map((f) => f.category).filter((c): c is string => !!c))).sort(),
    [food],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return food;
    return food.filter((f) =>
      [f.name, f.category].some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [food, search]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: form.name.trim(),
      unit: form.unit.trim() || "units",
      quantity: Number(form.quantity) || 0,
      category: form.category.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { error: saveError } = editing
      ? await supabase.from("food_items").update(payload).eq("id", editing.id)
      : await supabase.from("food_items").insert(payload);

    setSubmitting(false);
    if (saveError) {
      toast.error(saveError.message);
      return;
    }
    toast.success(editing ? `${payload.name} updated` : `${payload.name} added`);
    setDialogOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error: deleteError } = await supabase
      .from("food_items")
      .delete()
      .eq("id", deleteTarget.id);
    if (deleteError) toast.error(deleteError.message);
    else toast.success(`${deleteTarget.name} deleted`);
    setDeleteTarget(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs tabs={FOOD_TABS} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Food store</h1>
          <p className="text-sm text-muted-foreground">
            What&apos;s in the cupboard. Camp plans compare against this to work out the shopping.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add food
          </Button>
        )}
      </div>

      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search food…"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Loading food store…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Nothing in the food store yet.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>In stock</TableHead>
                <TableHead>Notes</TableHead>
                {(canEdit || canDelete) && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.category || "—"}</TableCell>
                  <TableCell>
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.notes || "—"}</TableCell>
                  {(canEdit || canDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => {
                              setEditing(item);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${item.name}`}
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit food item" : "Add food item"}</DialogTitle>
            <DialogDescription>
              Record how much is in stock so shopping lists only show what&apos;s missing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="food-name">Name</Label>
              <Input
                id="food-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="food-quantity">Quantity in stock</Label>
                <Input
                  id="food-quantity"
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="food-unit">Unit</Label>
                <Input
                  id="food-unit"
                  list="food-unit-options"
                  required
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
                <datalist id="food-unit-options">
                  {UNIT_SUGGESTIONS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="food-category">Category</Label>
              <Input
                id="food-category"
                list="food-category-options"
                placeholder="Tinned, Dry goods, Fresh…"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="food-category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="food-notes">Notes</Label>
              <Textarea
                id="food-notes"
                placeholder="Expiry dates, where it's kept…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editing ? "Save changes" : "Add food"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It will also be removed from any camp food plans. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
