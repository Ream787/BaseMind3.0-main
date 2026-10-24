/**
 * How much is standing in each room.
 *
 * Two questions, because two things hold a room open. `equipment_rooms`
 * says what kit is in it, counting the contents of boxes as being in the
 * room the box stands in; `storage_places` says which boxes and shelves
 * stand there. Either one is enough for ON DELETE RESTRICT to refuse, so
 * the rooms screen needs both to know whether to offer Delete at all.
 *
 * `equipment_rooms` is a view, and a view cannot be streamed over
 * realtime, so placement and place events re-read it rather than patching
 * rows — the same trade EquipmentContext makes.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { EMPTY_ROOM, type RoomContents } from "@/lib/roomErrors";

export function useRoomContents() {
  const [itemRows, setItemRows] = useState<{ room_id: string; quantity: number }[]>([]);
  const [placeRows, setPlaceRows] = useState<{ room_id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [items, places] = await Promise.all([
      supabase.from("equipment_rooms").select("room_id, quantity"),
      supabase.from("storage_places").select("room_id"),
    ]);
    if (items.data) setItemRows(items.data);
    if (places.data) setPlaceRows(places.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    // Unique per mount: removeChannel is asynchronous, and remounting
    // under a fixed name before the old channel has gone away makes
    // Supabase throw rather than tolerating it.
    const channel = supabase
      .channel(`room-contents-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "equipment_placements" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "storage_places" },
        () => void load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const byRoom = useMemo(() => {
    const map = new Map<string, RoomContents>();
    const bucket = (id: string) => {
      const existing = map.get(id);
      if (existing) return existing;
      const fresh = { ...EMPTY_ROOM };
      map.set(id, fresh);
      return fresh;
    };

    // One row per item per room, so counting rows counts kinds of kit.
    for (const row of itemRows) {
      const entry = bucket(row.room_id);
      entry.items += 1;
      entry.units += Number(row.quantity) || 0;
    }
    for (const row of placeRows) bucket(row.room_id).places += 1;

    return map;
  }, [itemRows, placeRows]);

  /** Rooms the list has no rows for are empty, not unknown. */
  const contentsOf = useCallback(
    (roomId: string): RoomContents => byRoom.get(roomId) ?? EMPTY_ROOM,
    [byRoom],
  );

  return { contentsOf, loading, reload: load };
}
