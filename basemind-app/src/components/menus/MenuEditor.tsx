import { useMemo, useState } from "react";
import { ChefHat, Plus, Trash2, Utensils } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { MEAL_SLOTS, mealsByDay } from "@/lib/menus";
import { roundQuantity } from "@/lib/shoppingList";
import type { FoodItem, Menu, MenuMeal, MenuMealItem } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MenuEditorProps {
  menu: Menu;
  meals: MenuMeal[];
  items: MenuMealItem[];
  food: FoodItem[];
  canEdit: boolean;
  /** Shown against each quantity when a camp menu is scaled. */
  scaleNote?: string;
}

export function MenuEditor({ menu, meals, items, food, canEdit, scaleNote }: MenuEditorProps) {
  const [newMealDay, setNewMealDay] = useState("1");
  const [newMealSlot, setNewMealSlot] = useState<string>(MEAL_SLOTS[0]);
  const [newMealName, setNewMealName] = useState("");
  const [addingMeal, setAddingMeal] = useState(false);

  const foodById = useMemo(() => new Map(food.map((f) => [f.id, f])), [food]);
  const days = useMemo(() => mealsByDay(meals), [meals]);

  async function addMeal() {
    if (!newMealName.trim()) return;
    setAddingMeal(true);
    const { error } = await supabase.from("menu_meals").insert({
      menu_id: menu.id,
      day_number: Math.max(1, Number(newMealDay) || 1),
      meal_slot: newMealSlot,
      name: newMealName.trim(),
      notes: null,
    });
    setAddingMeal(false);
    if (error) toast.error(error.message);
    else setNewMealName("");
  }

  async function removeMeal(mealId: string) {
    const { error } = await supabase.from("menu_meals").delete().eq("id", mealId);
    if (error) toast.error(error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex w-20 flex-col gap-1.5">
            <Label htmlFor="meal-day" className="text-xs">
              Day
            </Label>
            <Input
              id="meal-day"
              type="number"
              min={1}
              max={menu.day_count}
              value={newMealDay}
              onChange={(e) => setNewMealDay(e.target.value)}
            />
          </div>
          <div className="flex w-40 flex-col gap-1.5">
            <Label className="text-xs">Meal</Label>
            <Select value={newMealSlot} onValueChange={setNewMealSlot}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor="meal-name" className="text-xs">
              What&apos;s being cooked
            </Label>
            <Input
              id="meal-name"
              placeholder="Chicken potjie with rice"
              value={newMealName}
              onChange={(e) => setNewMealName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMeal();
                }
              }}
            />
          </div>
          <Button onClick={addMeal} disabled={addingMeal || !newMealName.trim()}>
            <Plus className="size-4" />
            Add meal
          </Button>
        </div>
      )}

      {days.length === 0 ? (
        <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground">
          <ChefHat className="size-5" />
          No meals planned yet.
        </div>
      ) : (
        days.map(({ day, meals: dayMeals }) => (
          <div key={day} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">Day {day}</h3>
            {dayMeals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                items={items.filter((i) => i.meal_id === meal.id)}
                food={food}
                foodById={foodById}
                canEdit={canEdit}
                scaleNote={scaleNote}
                onRemove={() => removeMeal(meal.id)}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

interface MealCardProps {
  meal: MenuMeal;
  items: MenuMealItem[];
  food: FoodItem[];
  foodById: Map<string, FoodItem>;
  canEdit: boolean;
  scaleNote?: string;
  onRemove: () => void;
}

function MealCard({ meal, items, food, foodById, canEdit, scaleNote, onRemove }: MealCardProps) {
  const [addFoodId, setAddFoodId] = useState("");
  const [addQty, setAddQty] = useState("1");

  const unused = food.filter((f) => !items.some((i) => i.food_item_id === f.id));

  async function addItem() {
    if (!addFoodId) return;
    const { error } = await supabase.from("menu_meal_items").insert({
      meal_id: meal.id,
      food_item_id: addFoodId,
      quantity: Math.max(0, Number(addQty) || 0),
    });
    if (error) toast.error(error.message);
    else {
      setAddFoodId("");
      setAddQty("1");
    }
  }

  async function updateQty(itemId: string, quantity: number) {
    const { error } = await supabase
      .from("menu_meal_items")
      .update({ quantity: Math.max(0, quantity) })
      .eq("id", itemId);
    if (error) toast.error(error.message);
  }

  async function removeItem(itemId: string) {
    const { error } = await supabase.from("menu_meal_items").delete().eq("id", itemId);
    if (error) toast.error(error.message);
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Utensils className="size-4 shrink-0 text-primary" />
          <div className="flex flex-col">
            <span className="font-medium">{meal.name}</span>
            <span className="text-xs text-muted-foreground">{meal.meal_slot}</span>
          </div>
        </div>
        {canEdit && (
          <Button variant="ghost" size="icon" aria-label={`Remove ${meal.name}`} onClick={onRemove}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t pt-3">
          {items.map((item) => {
            const foodItem = foodById.get(item.food_item_id);
            return (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{foodItem?.name ?? "Unknown ingredient"}</span>
                {canEdit ? (
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    className="h-7 w-20"
                    aria-label={`Quantity of ${foodItem?.name ?? "ingredient"}`}
                    value={item.quantity}
                    onChange={(e) => updateQty(item.id, Number(e.target.value) || 0)}
                  />
                ) : (
                  <span>{roundQuantity(item.quantity)}</span>
                )}
                <span className="w-14 text-muted-foreground">{foodItem?.unit ?? ""}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`Remove ${foodItem?.name ?? "ingredient"}`}
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
          {scaleNote && <li className="text-xs text-muted-foreground">{scaleNote}</li>}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <div className="min-w-40 flex-1">
            <Select value={addFoodId} onValueChange={setAddFoodId}>
              <SelectTrigger size="sm">
                <SelectValue placeholder="Add an ingredient…" />
              </SelectTrigger>
              <SelectContent>
                {unused.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Everything in the food store is already here
                  </div>
                ) : (
                  unused.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.unit})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            min={0}
            step="any"
            className="h-8 w-20"
            aria-label="Ingredient quantity"
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
          />
          <Button size="sm" onClick={addItem} disabled={!addFoodId}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
