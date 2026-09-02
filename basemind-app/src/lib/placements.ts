/**
 * Reading placements: where the units of a thing are, and how many.
 *
 * A placement is either "N in this storage place" or "N loose in this room".
 * A stored placement has no room of its own — it inherits the place's, and
 * that place inherits its parent's — so moving a cupboard between stores
 * moves everything inside it without touching a single placement. That is
 * the whole reason the room isn't copied onto the row.
 *
 * Placements are not required to add up to the item's total. Kit sits in a
 * car boot, goes missing, or simply hasn't been filed yet, and a model that
 * insisted on the sums balancing would force people to lie to it. The
 * difference is surfaced instead, as something to go and find.
 */
import type { Equipment, EquipmentPlacement, StoragePlace } from "@/types/database";

export const UNPLACED_LABEL = "Not placed yet";

/** Case-folded room key, matching how the equipment grid buckets rooms. */
export function roomKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The room a placement is in — its own, or the room of the place holding it. */
export function roomOf(
  placement: EquipmentPlacement,
  placesById: Map<string, StoragePlace>,
): string | null {
  if (placement.location !== null) return placement.location;
  if (placement.storage_id === null) return null;
  return placesById.get(placement.storage_id)?.location ?? null;
}

/**
 * A storage place and everything above it, room first.
 *
 * "Loft › Cupboard 1 › Top shelf" is what somebody needs to be told to find
 * the thing; "Top shelf" on its own is useless in a group with four of them.
 */
export function pathOf(
  place: StoragePlace,
  placesById: Map<string, StoragePlace>,
): string[] {
  const names: string[] = [];
  let current: StoragePlace | undefined = place;
  // Bounded rather than "while there is a parent": the database prevents
  // cycles, but a lost update or a stale cache should not spin the browser.
  for (let depth = 0; current && depth < 10; depth++) {
    names.unshift(current.name);
    current = current.parent_id ? placesById.get(current.parent_id) : undefined;
  }
  return [place.location, ...names];
}

/**
 * Everything a place sits inside, room end first.
 *
 * Used for the trail of links at the top of a place: standing in "Top shelf"
 * you want one tap back to the cupboard, not a jump to the room and a hunt.
 */
export function ancestorsOf(
  place: StoragePlace,
  placesById: Map<string, StoragePlace>,
): StoragePlace[] {
  const chain: StoragePlace[] = [];
  let current = place.parent_id ? placesById.get(place.parent_id) : undefined;
  for (let depth = 0; current && depth < 10; depth++) {
    chain.unshift(current);
    current = current.parent_id ? placesById.get(current.parent_id) : undefined;
  }
  return chain;
}

/**
 * The trail as one line, with the middle dropped when it is long.
 *
 * "Loft › Cupboard 1 › Top shelf › Box 3" does not fit in a table cell, and
 * truncating it from the end cuts off the box — the one part you actually
 * walk to. Keeping the room and the innermost place says where to go and
 * what to look for; the steps between are on the place's own page.
 */
export function describePath(segments: string[]): string {
  if (segments.length <= 3) return segments.join(" › ");
  return `${segments[0]} › … › ${segments[segments.length - 1]}`;
}

/** Just the trail inside the room, without repeating the room itself. */
export function pathInsideRoom(
  place: StoragePlace,
  placesById: Map<string, StoragePlace>,
): string {
  return pathOf(place, placesById).slice(1).join(" › ");
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
 * How many are not in any storage place or room yet.
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

/** The items directly in one storage place, with how many of each. */
export function storageContents(
  storageId: string,
  placements: EquipmentPlacement[],
  equipmentById: Map<string, Equipment>,
): { item: Equipment; placement: EquipmentPlacement }[] {
  return placements
    .filter((p) => p.storage_id === storageId)
    .map((placement) => {
      const item = equipmentById.get(placement.equipment_id);
      return item ? { item, placement } : null;
    })
    .filter((row): row is { item: Equipment; placement: EquipmentPlacement } => row !== null)
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
}

/** The places sitting directly inside this one. */
export function childrenOf(placeId: string | null, places: StoragePlace[]): StoragePlace[] {
  return places
    .filter((p) => p.parent_id === placeId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A place, everything inside it, and everything inside those. */
export function subtreeIds(placeId: string, places: StoragePlace[]): string[] {
  const ids = [placeId];
  for (let i = 0; i < ids.length && i < 500; i++) {
    for (const child of places) {
      if (child.parent_id === ids[i] && !ids.includes(child.id)) ids.push(child.id);
    }
  }
  return ids;
}

/** How many item rows are in a place and everything nested inside it. */
export function countWithin(
  placeId: string,
  places: StoragePlace[],
  placements: EquipmentPlacement[],
): number {
  const within = new Set(subtreeIds(placeId, places));
  return placements.filter((p) => p.storage_id && within.has(p.storage_id)).length;
}

/**
 * Items loose in a room — in the room itself rather than in anything
 * standing in it.
 */
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

/**
 * Kit filed in two places at once: loose in a room, and in something
 * standing in that same room.
 *
 * Not a data error the database could refuse — six of a thing really can be
 * in a box while two sit on the floor — but it is almost never what somebody
 * meant. Putting kit in a box used to leave the room's pile untouched, so
 * a store full of packed boxes went on listing everything as loose as well.
 * Finding these is what lets the app offer to put them away.
 */
export type StrayLoose = {
  item: Equipment;
  /** Units lying loose in the room. */
  loose: number;
  /** The place in this room that already holds most of it. */
  place: StoragePlace;
  inPlace: number;
  /**
   * Of the loose units, how many the place is already counting.
   *
   * Placements adding up to more than the group owns are lying, and the
   * surplus is the second record of kit already filed. Those units are
   * dropped from the room rather than added to the place — adding them would
   * count the same tent twice and claim eight of four.
   */
  duplicate: number;
  /** The rest: genuinely on the floor, and genuinely moving into the place. */
  moving: number;
};

export function strayLooseItems(
  room: string,
  placements: EquipmentPlacement[],
  places: StoragePlace[],
  equipmentById: Map<string, Equipment>,
): StrayLoose[] {
  const wanted = roomKey(room);
  const here = new Map(
    places.filter((p) => roomKey(p.location) === wanted).map((p) => [p.id, p]),
  );

  const rows: StrayLoose[] = [];

  for (const placement of placements) {
    if (placement.location === null) continue;
    if (roomKey(placement.location) !== wanted) continue;

    const item = equipmentById.get(placement.equipment_id);
    if (!item) continue;

    // Where else in this room the same item is filed. The biggest pile wins,
    // by name when they tie, so the suggestion is the same every time it is
    // asked rather than shuffling between two identical boxes.
    let best: { place: StoragePlace; quantity: number } | null = null;
    for (const other of placements) {
      if (other.equipment_id !== item.id || other.storage_id === null) continue;
      const place = here.get(other.storage_id);
      if (!place) continue;
      if (
        !best ||
        other.quantity > best.quantity ||
        (other.quantity === best.quantity && place.name.localeCompare(best.place.name) < 0)
      ) {
        best = { place, quantity: other.quantity };
      }
    }

    if (best) {
      const placed = placements
        .filter((p) => p.equipment_id === item.id)
        .reduce((sum, p) => sum + p.quantity, 0);
      const duplicate = Math.min(placement.quantity, Math.max(0, placed - item.quantity));
      rows.push({
        item,
        loose: placement.quantity,
        place: best.place,
        inPlace: best.quantity,
        duplicate,
        moving: placement.quantity - duplicate,
      });
    }
  }

  return rows.sort((a, b) => a.item.name.localeCompare(b.item.name));
}

/** Every room that holds something, loose or stored. */
export function roomsInUse(
  placements: EquipmentPlacement[],
  places: StoragePlace[],
): { key: string; name: string }[] {
  const placesById = new Map(places.map((p) => [p.id, p]));
  const rooms = new Map<string, string>();

  for (const place of places) {
    const name = place.location.trim();
    if (name) rooms.set(roomKey(name), name);
  }
  for (const placement of placements) {
    const name = roomOf(placement, placesById)?.trim();
    if (name) rooms.set(roomKey(name), name);
  }

  return [...rooms.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

/**
 * A one-line answer to "where is this?", for the inventory list.
 *
 * Written as a trail — "Loft › Cupboard 1 › Box 3 ×5" — because the name of
 * a shelf means nothing on its own once a group has four of them, and the
 * room alone would send somebody to look at a wall of identical crates. A
 * deep trail keeps its two ends and drops the middle.
 */
export function describePlacements(
  item: Equipment,
  placements: EquipmentPlacement[] = [],
  placesById: Map<string, StoragePlace>,
): string {
  const parts = placementParts(item, placements, placesById);

  // Nothing filed anywhere reads as a plain "Not placed yet". Appending the
  // count there produced "not placed yet 1", which states the obvious in the
  // clumsiest way available: if none of it is placed, how many is all of it.
  if (parts.length === 1 && parts[0].unplaced) return UNPLACED_LABEL;

  return parts
    .map((part) => `${part.unplaced ? part.where.toLowerCase() : part.where} ×${part.quantity}`)
    .join(" · ");
}

/** One place this item's units are, and how many are there. */
export type PlacementPart = {
  where: string;
  quantity: number;
  /** True for the tail row: units not filed anywhere yet. */
  unplaced: boolean;
};

/**
 * The same answer as describePlacements, in pieces.
 *
 * A phone card cannot show "Loft › … › Box 3 ×5 · Loft ×2 · not placed yet
 * ×3" as one right-aligned run of text without it wrapping into a ragged
 * block that reads as noise. Given the parts, it can put one place per line
 * with the count against the edge, which is the same information and
 * actually legible on the walk to the store.
 */
export function placementParts(
  item: Equipment,
  placements: EquipmentPlacement[] = [],
  placesById: Map<string, StoragePlace>,
): PlacementPart[] {
  const parts = placements
    .map((p) => {
      if (p.storage_id !== null) {
        const place = placesById.get(p.storage_id);
        return place
          ? {
              where: describePath(pathOf(place, placesById)),
              quantity: p.quantity,
              unplaced: false,
            }
          : null;
      }
      const room = (p.location ?? "").trim();
      return room ? { where: room, quantity: p.quantity, unplaced: false } : null;
    })
    .filter((part): part is PlacementPart => part !== null)
    .sort((a, b) => b.quantity - a.quantity || a.where.localeCompare(b.where));

  const spare = unplacedQuantity(item, placements);
  // Everything unaccounted for is one row at the end — including the case
  // where none of it is placed, which is the whole quantity.
  if (spare > 0 || parts.length === 0) {
    parts.push({ where: UNPLACED_LABEL, quantity: spare || item.quantity, unplaced: true });
  }

  return parts;
}
