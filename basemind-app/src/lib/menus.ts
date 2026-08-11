import type { Menu, MenuMeal, MenuMealItem } from "@/types/database";
import { roundQuantity } from "@/lib/shoppingList";

/** Meal slots in the order they happen, for sorting a day's meals. */
export const MEAL_SLOTS = [
  "Breakfast",
  "Morning snack",
  "Lunch",
  "Afternoon snack",
  "Dinner",
  "Supper",
] as const;

export const MENU_CATEGORIES = [
  "Camping",
  "Hiking",
  "Day trip",
  "Indoor",
  "Backpacking",
] as const;

/** Position of a slot in the day; unknown slots sort last, then alphabetically. */
export function mealSlotOrder(slot: string): number {
  const index = MEAL_SLOTS.findIndex((s) => s.toLowerCase() === slot.trim().toLowerCase());
  return index === -1 ? MEAL_SLOTS.length : index;
}

export function sortMeals(meals: MenuMeal[]): MenuMeal[] {
  return [...meals].sort(
    (a, b) =>
      a.day_number - b.day_number ||
      mealSlotOrder(a.meal_slot) - mealSlotOrder(b.meal_slot) ||
      a.meal_slot.localeCompare(b.meal_slot) ||
      a.name.localeCompare(b.name),
  );
}

/** Meals grouped into days, each day's meals in the order they're eaten. */
export function mealsByDay(meals: MenuMeal[]): { day: number; meals: MenuMeal[] }[] {
  const days = new Map<number, MenuMeal[]>();
  for (const meal of sortMeals(meals)) {
    const bucket = days.get(meal.day_number);
    if (bucket) bucket.push(meal);
    else days.set(meal.day_number, [meal]);
  }
  return [...days.entries()]
    .map(([day, dayMeals]) => ({ day, meals: dayMeals }))
    .sort((a, b) => a.day - b.day);
}

/**
 * How much a menu scales by for a given headcount.
 *
 * Falls back to 1 when there's no headcount to scale to, so quantities are
 * used exactly as written rather than silently zeroed.
 */
export function menuScale(menu: Pick<Menu, "serves">, headcount: number | null): number {
  if (!headcount || headcount <= 0) return 1;
  if (!menu.serves || menu.serves <= 0) return 1;
  return headcount / menu.serves;
}

export type AggregatedRequirement = {
  id: string;
  food_item_id: string;
  quantity: number;
  /** Which meals contribute to this total, for showing the working. */
  fromMeals: string[];
};

/**
 * Rolls a menu's meals up into one quantity per ingredient.
 *
 * The same ingredient across several meals has to add up — rice at lunch on
 * day one and dinner on day two is one line on the shopping list, not two.
 */
export function aggregateMenuRequirements(
  meals: MenuMeal[],
  items: MenuMealItem[],
  scale = 1,
): AggregatedRequirement[] {
  const mealsById = new Map(meals.map((meal) => [meal.id, meal]));
  const totals = new Map<string, { quantity: number; fromMeals: string[] }>();

  for (const item of items) {
    const meal = mealsById.get(item.meal_id);
    // Skip items whose meal isn't in this menu (e.g. a stale realtime row).
    if (!meal) continue;

    const existing = totals.get(item.food_item_id);
    const scaled = item.quantity * scale;
    if (existing) {
      existing.quantity += scaled;
      if (!existing.fromMeals.includes(meal.name)) existing.fromMeals.push(meal.name);
    } else {
      totals.set(item.food_item_id, { quantity: scaled, fromMeals: [meal.name] });
    }
  }

  return [...totals.entries()]
    .map(([food_item_id, { quantity, fromMeals }]) => ({
      // Stable synthetic id — these rows don't exist in a table of their own.
      id: `menu:${food_item_id}`,
      food_item_id,
      quantity: roundQuantity(quantity),
      fromMeals,
    }))
    .sort((a, b) => a.food_item_id.localeCompare(b.food_item_id));
}

/**
 * Combines menu-derived requirements with anything added by hand on the
 * event, summing where both name the same ingredient.
 */
export function mergeRequirements(
  fromMenu: AggregatedRequirement[],
  manual: { id: string; food_item_id: string; quantity: number }[],
): AggregatedRequirement[] {
  const merged = new Map<string, AggregatedRequirement>();

  for (const req of fromMenu) merged.set(req.food_item_id, { ...req });

  for (const req of manual) {
    const existing = merged.get(req.food_item_id);
    if (existing) {
      existing.quantity = roundQuantity(existing.quantity + req.quantity);
      existing.fromMeals = [...existing.fromMeals, "Added separately"];
    } else {
      merged.set(req.food_item_id, {
        id: req.id,
        food_item_id: req.food_item_id,
        quantity: roundQuantity(req.quantity),
        fromMeals: ["Added separately"],
      });
    }
  }

  return [...merged.values()];
}
