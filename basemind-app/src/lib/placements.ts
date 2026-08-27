/**
 * Reading placements: where the units of a thing are, and how many.
 *
 * A placement is either "N in this box" or "N loose in this room". A boxed
 * placement has no room of its own — it inherits the box's — so moving a box
 * between stores moves everything in it without touching a placement. That is
 * the whole reason the room isn't copied onto the row.
 *
 * Placements are not required to add up to the item's total. Kit sits in a
 * car boot, goes missing, or simply hasn't been filed yet, and a model that
 * insisted on the sums balancing would force people to lie to it. The
 * difference is surfaced instead, as something to go and find.
 */
import type { Equipment, EquipmentBox, EquipmentPlacement } from "@/types/database";

export const UNPLACED_LABEL = "Not placed yet";

/** Case-folded room key, matching how the equipment grid buckets rooms. */
export function roomKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The room a placement is in — its own, or the room of the box it's in. */
export function roomOf(
  placement: EquipmentPlacement,
  boxesById: Map<string, EquipmentBox>,
): string | null {
  if (placement.location !== null) return placement.location;
  if (placement.box_id === null) return null;
  return boxesById.get(placement.box_id)?.location ?? null;
}

/** Index placements by the item they describe. */
export function byEquipment(
  placements: EquipmentPlacement[],
): Map<string, EquipmentPlacement[]> {
  const map = new Map<string, EquipmentPlacement[]>();
  for (const p of placements) {
    const bucket = map.get(p.equipment_id);
    if (bucket) bucket.push(p);
    else map.set(p.equipment_id, [p]);
  }
  return map;
}

/** How many of this item are accounted for anywhere. */
export function placedQuantity(placements: EquipmentPlacement[] = []): number {
  return placements.reduce((sum, p) => sum + p.quantity, 0);
}

/**
 * How many are not in any box or room yet.
 *
 * Negative would mean the placements claim more than the group owns, which is
 * a data-entry slip rather than a real state, so it is clamped to zero and the
 * discrepancy is reported separately by `isOverPlaced`.
 */
export function unplacedQuantity(item: Equipment, placements: EquipmentPlacement[] = []): number {
  return Math.max(0, item.quantity - placedQuantity(placements));
}

/** True when more units are placed than the item's total says exist. */
export function isOverPlaced(item: Equipment, placements: EquipmentPlacement[] = []): boolean {
  return placedQuantity(placements) > item.quantity;
}

/** The items in a box, with how many of each. */
export function boxContents(
  boxId: string,
  placements: EquipmentPlacement[],
  equipmentById: Map<string, Equipment>,
): { item: Equipment; placement: EquipmentPlacement }[] {
  return placements
    .filter((p) => p.box_id === boxId)
    .map((placement) => {
      const item = equipmentById.get(placement.equipment_id);
      return item ? { item, placement } : null;
    })
    .filter((row): row is { item: Equipment; placement: EquipmentPlacement } => row !== null)
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
}

/** Items loose in a room — in the room itself rather than in one of its boxes. */
export function looseInRoom(
  room: string,
  placements: EquipmentPlacement[],
  equipmentById: Map<string, Equipment>,
): { item: Equipment; placement: EquipmentPlacement }[] {
  const wanted = roomKey(room);
  return placements
    .filter((p) => p.location !== null && roomKey(p.location) === wanted)
    .map((placement) => {
      const item = equipmentById.get(placement.equipment_id);
      return item ? { item, placement } : null;
    })
    .filter((row): row is { item: Equipment; placement: EquipmentPlacement } => row !== null)
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
}

/** Every room that holds something, whether loose or in a box. */
export function roomsInUse(
  placements: EquipmentPlacement[],
  boxes: EquipmentBox[],
): { key: string; name: string }[] {
  const boxesById = new Map(boxes.map((b) => [b.id, b]));
  const rooms = new Map<string, string>();

  for (const box of boxes) {
    const name = box.location.trim();
    if (name) rooms.set(roomKey(name), name);
  }
  for (const placement of placements) {
    const name = roomOf(placement, boxesById)?.trim();
    if (name) rooms.set(roomKey(name), name);
  }

  return [...rooms.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/**
 * A one-line answer to "where is this?", for the inventory list.
 *
 * Boxes are named rather than reduced to their room: "Cooking box 1" is what
 * someone is about to go and open, and "Container" would send them to look at
 * a shelf of five identical crates.
 */
export function describePlacements(
  item: Equipment,
  placements: EquipmentPlacement[] = [],
  boxesById: Map<string, EquipmentBox>,
): string {
  const parts = placements
    .map((p) => {
      const where =
        p.box_id !== null ? boxesById.get(p.box_id)?.name : (p.location ?? "").trim();
      return where ? { where, quantity: p.quantity } : null;
    })
    .filter((part): part is { where: string; quantity: number } => part !== null)
    .sort((a, b) => b.quantity - a.quantity || a.where.localeCompare(b.where))
    .map((part) => `${part.where} ${part.quantity}`);

  // Nothing filed anywhere reads as a plain "Not placed yet". Appending the
  // count there produced "not placed yet 1", which states the obvious in the
  // clumsiest way available: if none of it is placed, how many is all of it.
  if (parts.length === 0) return UNPLACED_LABEL;

  const spare = unplacedQuantity(item, placements);
  if (spare > 0) parts.push(`${UNPLACED_LABEL.toLowerCase()} ${spare}`);

  return parts.join(" · ");
}
