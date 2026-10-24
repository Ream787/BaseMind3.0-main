/**
 * Turning the rooms table's three rules into sentences a leader can act on.
 *
 * Postgres enforces all three and explains none of them:
 *
 *  - `idx_rooms_name` is unique on `lower(btrim(name))`, so "Room 5",
 *    "room 5" and " Room  5 " are one room. The failure arrives as
 *    "duplicate key value violates unique constraint idx_rooms_name",
 *    which does not say which room is already called that.
 *  - `rooms_name_not_blank` rejects a name that is only spaces, as
 *    "violates check constraint".
 *  - Both `room_id` foreign keys are ON DELETE RESTRICT, deliberately:
 *    emptying a room is a decision somebody makes, not a side effect of
 *    tidying the list. The failure names a constraint rather than the nine
 *    items standing in the way.
 *
 * The clash and the blank are also checked before the write, so the form
 * can say so while somebody is still typing. The error codes below are the
 * backstop for the gap between the two: two people adding "Store" at once,
 * or a room list that has not caught up with somebody else's rename.
 */
import { roomKey } from "@/lib/placements";
import type { Room } from "@/types/database";

/** As much of a PostgrestError as any of this needs. */
type PgError = { code?: string; message?: string };

/** What is standing in a room, and therefore what stops it being deleted. */
export type RoomContents = {
  /** Distinct kinds of kit, however many units of each. */
  items: number;
  /** Units, counting the contents of boxes standing in the room. */
  units: number;
  /** Storage places standing directly in the room. */
  places: number;
};

export const EMPTY_ROOM: RoomContents = { items: 0, units: 0, places: 0 };

/**
 * The room a typed name would collide with, ignoring case and spacing.
 *
 * `exceptId` is the room being renamed: it always matches itself, and
 * "Room 5 clashes with Room 5" is not a thing worth saying.
 */
export function clashingRoom(
  name: string,
  rooms: Room[],
  exceptId?: string,
): Room | undefined {
  const key = roomKey(name);
  if (!key) return undefined;
  return rooms.find((room) => room.id !== exceptId && roomKey(room.name) === key);
}

/** What is wrong with a typed name, or null when there is nothing wrong. */
export function nameProblem(
  name: string,
  rooms: Room[],
  exceptId?: string,
): string | null {
  if (!name.trim()) return "A room needs a name.";
  const clash = clashingRoom(name, rooms, exceptId);
  if (!clash) return null;
  return `There is already a room called “${clash.name}”. Two rooms cannot share a name, even spelled with different capitals or spacing.`;
}

/** Why a save bounced, in a sentence. */
export function roomSaveError(
  error: unknown,
  name: string,
  rooms: Room[],
  exceptId?: string,
): string {
  const err = error as PgError;

  if (err?.code === "23505") {
    // Whoever got there first may not be in our copy of the list yet, so
    // name them only when we actually have them.
    const clash = clashingRoom(name, rooms, exceptId);
    return clash
      ? `There is already a room called “${clash.name}”. Two rooms cannot share a name, even spelled with different capitals or spacing.`
      : `Somebody has just added a room called “${name.trim()}”. Pick another name, or use theirs.`;
  }
  if (err?.code === "23514") return "A room needs a name.";
  // room_id_for raises this for a blank name, with that same wording.
  if (err?.code === "P0001") return err.message ?? "A room needs a name.";
  if (err?.code === "42501") return "You don't have permission to change rooms.";

  return err?.message ?? "Something went wrong.";
}

/** "9 items and 2 storage places", for a room that will not go quietly. */
export function describeContents(contents: RoomContents): string {
  const parts: string[] = [];
  if (contents.items > 0) {
    parts.push(`${contents.items} ${contents.items === 1 ? "item" : "items"}`);
  }
  if (contents.places > 0) {
    parts.push(`${contents.places} ${contents.places === 1 ? "storage place" : "storage places"}`);
  }
  return parts.join(" and ");
}

/**
 * Why a delete bounced.
 *
 * The screen already refuses to offer Delete on a room it knows holds
 * something, so reaching here means our counts were behind — somebody put
 * kit in the room while this page was open. Say what is in there now
 * rather than quoting the foreign key.
 */
export function roomDeleteError(
  error: unknown,
  room: Room,
  contents: RoomContents | undefined,
): string {
  const err = error as PgError;

  if (err?.code === "23503") {
    const held = contents ? describeContents(contents) : "";
    return held
      ? `${room.name} still holds ${held}. Move them somewhere else first, then the room can go.`
      : `${room.name} still has things in it — somebody has just filed something there. Move it somewhere else first, then the room can go.`;
  }
  if (err?.code === "42501") return "You don't have permission to delete rooms.";

  return err?.message ?? "Something went wrong.";
}
