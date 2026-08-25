import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { findFoodByName } from "@/lib/menus";
import type { FoodItem } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const UNIT_SUGGESTIONS = ["kg", "g", "litres", "ml", "tins", "packets", "loaves", "units"];

interface NewIngredientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food: FoodItem[];
  /** Prefills the name when the user has already typed one. */
  initialName?: string;
  /** Called with the food item to use — newly created, or the existing match. */
  onReady: (foodItemId: string) => void | Promise<void>;
}

/**
 * Creates a food item without leaving the menu.
 *
 * Ingredients live in the food store because the shopping list compares
 * against stock, so planning a meal around something you've never recorded
 * used to mean going to the Food page and coming back. This adds it in place.
 */
export function NewIngredientDialog({
  open,
  onOpenChange,
  food,
  initialName = "",
  onReady,
}: NewIngredientDialogProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("units");
  const [category, setCategory] = useState("");
  const [inStock, setInStock] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setUnit("units");
    setCategory("");
    setInStock("0");
  }, [open, initialName]);

  const existing = findFoodByName(food, name);

  const categories = Array.from(
    new Set(food.map((f) => f.category).filter((c): c is string => !!c)),
  ).sort();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    // Already in the store under this name — use it rather than making a
    // second row that would split stock across two spellings.
    if (existing) {
      await onReady(existing.id);
      onOpenChange(false);
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("food_items")
      .insert({
        name: trimmed,
        unit: unit.trim() || "units",
        quantity: Number(inStock) || 0,
        category: category.trim() || null,
        notes: null,
      })
      .select()
      .single();
    setSaving(false);

    if (error || !data) {
      toast.error(error?.message ?? "Couldn't add that ingredient.");
      return;
    }
    toast.success(`${trimmed} added to the food store`);
    await onReady(data.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New ingredient</DialogTitle>
          <DialogDescription>
            This is added to the food store too, so shopping lists can tell what you already have.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-ing-name">Name</Label>
            <Input
              id="new-ing-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {existing && (
              <p className="text-sm text-muted-foreground">
                &ldquo;{existing.name}&rdquo; is already in the food store — it&apos;ll use that
                one instead of adding a duplicate.
              </p>
            )}
          </div>

          {!existing && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-ing-unit">Measured in</Label>
                  <Input
                    id="new-ing-unit"
                    list="new-ing-units"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                  <datalist id="new-ing-units">
                    {UNIT_SUGGESTIONS.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-ing-stock">Already in stock</Label>
                  <Input
                    id="new-ing-stock"
                    type="number"
                    min={0}
                    step="any"
                    value={inStock}
                    onChange={(e) => setInStock(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-ing-category">Category (optional)</Label>
                <Input
                  id="new-ing-category"
                  list="new-ing-categories"
                  placeholder="Dry goods, Tinned, Fresh…"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
                <datalist id="new-ing-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Adding…" : existing ? "Use existing" : "Add ingredient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
