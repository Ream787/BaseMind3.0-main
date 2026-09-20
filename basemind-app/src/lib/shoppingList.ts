import type { FoodItem } from "@/types/database";

/**
 * The fields a requirement needs, whatever produced it — a row typed in on the
 * event, or a total rolled up from the menu's meals.
 */
export type FoodRequirement = {
  id: string;
  food_item_id: string;
  quantity: number;
};

export type FoodPlanLine = {
  eventFoodId: string;
  foodItemId: string;
  name: string;
  unit: string;
  category: string | null;
  /** How much the camp needs. */
  needed: number;
  /** How much is in the food store in total. */
  inStock: number;
  /** How much of that stock other upcoming camps have already claimed. */
  claimedElsewhere: number;
  /** Which camps claimed it, for explaining the number. */
  claimedBy: string[];
  /** Stock this camp can actually count on: inStock - claimedElsewhere. */
  availableToUs: number;
  /** Shortfall to buy; 0 when available stock already covers it. */
  toBuy: number;
};

/**
 * What other camps have already committed, per food item.
 *
 * Without this, two camps a fortnight apart each see the full cupboard and
 * neither shopping list mentions the bread the other one is taking.
 */
export type StockClaim = { quantity: number; byEvent: string[] };

export function buildClaims(
  otherRequirements: { eventName: string; food_item_id: string; quantity: number }[],
): Map<string, StockClaim> {
  const claims = new Map<string, StockClaim>();
  for (const req of otherRequirements) {
    const existing = claims.get(req.food_item_id);
    if (existing) {
      existing.quantity = roundQuantity(existing.quantity + req.quantity);
      if (!existing.byEvent.includes(req.eventName)) existing.byEvent.push(req.eventName);
    } else {
      claims.set(req.food_item_id, {
        quantity: roundQuantity(req.quantity),
        byEvent: [req.eventName],
      });
    }
  }
  return claims;
}

/**
 * Joins a camp's food requirements against the food store, minus anything
 * other upcoming camps have already spoken for.
 *
 * Requirements whose food item no longer exists are skipped rather than shown
 * as nameless rows — the DB cascade should prevent it, but a stale realtime
 * payload can briefly leave one behind.
 */
export function buildFoodPlan(
  requirements: FoodRequirement[],
  stock: FoodItem[],
  claims: Map<string, StockClaim> = new Map(),
): FoodPlanLine[] {
  const stockById = new Map(stock.map((item) => [item.id, item]));

  return requirements
    .map((req) => {
      const item = stockById.get(req.food_item_id);
      if (!item) return null;
      const claim = claims.get(item.id);
      const claimedElsewhere = claim?.quantity ?? 0;
      // Can't rely on more than exists, even if claims exceed the shelf.
      const availableToUs = Math.max(0, roundQuantity(item.quantity - claimedElsewhere));
      return {
        eventFoodId: req.id,
        foodItemId: item.id,
        name: item.name,
        unit: item.unit,
        category: item.category,
        needed: req.quantity,
        inStock: item.quantity,
        claimedElsewhere,
        claimedBy: claim?.byEvent ?? [],
        availableToUs,
        // Rounded to shake off float noise like 0.30000000000000004, and up
        // to the next whole one for things sold as things: a shop has no way
        // to sell 0.75 of a tin, and a list that asks for it makes the person
        // holding it do the arithmetic in the aisle.
        toBuy: buyQuantity(req.quantity - availableToUs, item.unit),
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

/**
 * Units that come in whole ones. Everything else — kg, g, litres, ml — is
 * weighed or poured, and 0.4 kg of cheese is a perfectly good thing to buy.
 *
 * Matching is loose on purpose: a food store filled in by hand has "tin",
 * "tins", "Tins" and "TIN" in it.
 */
const COUNTABLE = new Set([
  "unit", "units", "tin", "tins", "can", "cans", "packet", "packets", "pack", "packs",
  "jar", "jars", "bottle", "bottles", "loaf", "loaves", "box", "boxes", "bag", "bags",
  "head", "heads", "punnet", "punnets", "roll", "rolls", "tub", "tubs", "block", "blocks",
  "slab", "slabs", "bunch", "bunches", "dozen", "each", "piece", "pieces", "sachet", "sachets",
]);

export function isCountableUnit(unit: string): boolean {
  return COUNTABLE.has(unit.trim().toLowerCase());
}

/**
 * How much to put on the shopping list.
 *
 * Countable things round up — needing 3.75 tins means buying 4 — and anything
 * weighed keeps its decimal. Under a thousandth is treated as covered, so
 * float noise doesn't send somebody to the shop for one tin of nothing.
 */
export function buyQuantity(shortfall: number, unit: string): number {
  const trimmed = roundQuantity(shortfall);
  if (trimmed <= 0) return 0;
  return isCountableUnit(unit) ? Math.ceil(trimmed) : trimmed;
}

/**
 * Units written in the plural in the food store, and how they read for one.
 *
 * Only the countable ones: "1 kg" and "1 litres" are not the same mistake.
 */
const SINGULAR: Record<string, string> = {
  units: "unit",
  tins: "tin",
  cans: "can",
  packets: "packet",
  packs: "pack",
  jars: "jar",
  bottles: "bottle",
  loaves: "loaf",
  boxes: "box",
  bags: "bag",
  heads: "head",
  punnets: "punnet",
  rolls: "roll",
  tubs: "tub",
  blocks: "block",
  slabs: "slab",
  bunches: "bunch",
  pieces: "piece",
  sachets: "sachet",
  litres: "litre",
  liters: "liter",
};

/**
 * Formats a quantity for display, dropping a redundant trailing ".0" and
 * saying "1 packet" rather than "1 packets".
 */
export function formatQuantity(value: number, unit: string): string {
  const rounded = roundQuantity(value);
  const trimmed = unit.trim();
  if (rounded !== 1) return `${rounded} ${trimmed}`;
  return `${rounded} ${SINGULAR[trimmed.toLowerCase()] ?? trimmed}`;
}
