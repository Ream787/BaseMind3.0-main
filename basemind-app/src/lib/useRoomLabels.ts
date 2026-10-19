/**
 * "Where is this?" in one line, for pages that only need to say it.
 *
 * equipment.location used to answer this: one room name on the item,
 * readable anywhere without loading anything else. It was also wrong — it
 * could name only one room for kit that is split between two, and it said
 * nothing about which box in the room.
 *
 * public.equipment_rooms replaces it. It rolls placements up per room and
 * counts the contents of a box as being in the room the box stands in, so a
 * single read gives every item's rooms. Pages that need the full trail
 * ("Loft › Cupboard 1 › Box 3") want placements and describePlacements
 * instead; this is the short answer for lists, pickers and printouts.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/client";

export type ItemRoom = {
  equipment_id: string;
  room_id: string;
  room_name: string;
  quantity: number;
};

/** Biggest pile first, so the label leads with where most of it is. */
export function groupByItem(rows: ItemRoom[]): Map<string, ItemRoom[]> {
  const byItem = new Map<string, ItemRoom[]>();
  for (const row of rows) {
    const bucket = byItem.get(row.equipment_id);
    if (bucket) bucket.push(row);
    else byItem.set(row.equipment_id, [row]);
  }
  for (const bucket of byItem.values()) {
    bucket.sort((a, b) => b.quantity - a.quantity || a.room_name.localeCompare(b.room_name));
  }
  return byItem;
}

/**
 * One room reads as its name. Kit spread over several reads as each room
 * and how many are there, because "Room 5" alone would be a lie about the
 * six in the hall store. Nothing filed anywhere reads as a dash.
 */
export function labelFor(where: ItemRoom[] | undefined): string {
  if (!where || where.length === 0) return "—";
  if (where.length === 1) return where[0].room_name;
  return where.map((r) => `${r.room_name} ×${r.quantity}`).join(" · ");
}

/**
 * Room labels for every item, for pages outside EquipmentProvider.
 *
 * Inside it, useEquipment().roomLabel is the same thing off data the
 * provider already holds — use that rather than reading the view twice.
 */
export function useRoomLabels() {
  const [rows, setRows] = useState<ItemRoom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("equipment_rooms")
      .select("*")
      .then(({ data }) => {
        if (!active) return;
        setRows(data ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const byItem = useMemo(() => groupByItem(rows), [rows]);

  const roomLabel = useCallback((equipmentId: string) => labelFor(byItem.get(equipmentId)), [byItem]);

  return { roomLabel, loading };
}
