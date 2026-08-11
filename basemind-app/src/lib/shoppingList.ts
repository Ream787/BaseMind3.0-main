import type { EventFood, FoodItem } from "@/types/database";

export type FoodPlanLine = {
  eventFoodId: string;
  foodItemId: string;
  name: string;
  unit: string;
  category: string | null;
  /** How much the camp needs. */
  needed: number;
  /** How much is currently in the food store. */
  inStock: number;
  /** Shortfall to buy; 0 when stock already covers it. */
  toBuy: number;
};

/**
 * Joins a camp's food requirements against the food store.
 *
 * Requirements whose food item no longer exists are skipped rather than shown
 * as nameless rows — the DB cascade should prevent it, but a stale realtime
 * payload can briefly leave one behind.
 */
export function buildFoodPlan(requirements: EventFood[], stock: FoodItem[]): FoodPlanLine[] {
  const stockById = new Map(stock.map((item) => [item.id, item]));

  return requirements
    .map((req) => {
      const item = stockById.get(req.food_item_id);
      if (!item) return null;
      const needed = req.quantity;
      const inStock = item.quantity;
      return {
        eventFoodId: req.id,
        foodItemId: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category,
        needed,
        inStock,
        // Rounded to shake off float noise like 0.30000000000000004
        toBuy: Math.max(0, roundQuantity(needed - inStock)),
      };
    })
    .filter((line): line is FoodPlanLine => line !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/** Only the lines that actually need buying. */
export function toShoppingList(plan: FoodPlanLine[]): FoodPlanLine[] {
  return plan.filter((line) => line.toBuy > 0);
}

/** Trims binary-float artefacts without disturbing sensible decimals. */
export function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Formats a quantity for display, dropping a redundant trailing ".0". */
export function formatQuantity(value: number, unit: string): string {
  return `${roundQuantity(value)} ${unit}`;
}
