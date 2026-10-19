import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabase/client";
import { groupByItem, labelFor, type ItemRoom } from "@/lib/useRoomLabels";
import type {
  Equipment,
  NewEquipment,
  EquipmentUpdate,
  Room,
} from "@/types/database";

interface EquipmentContextType {
  equipment: Equipment[];
  /** Every room, including ones with nothing in them. */
  rooms: Room[];
  roomsById: Map<string, Room>;
  loading: boolean;
  error: string | null;
  /** Returns the created row, so the caller can file it in a room. */
  addEquipment: (input: NewEquipment) => Promise<Equipment>;
  updateEquipment: (id: string, patch: EquipmentUpdate) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  /**
   * A short "where is it" label for one item: the room, or each room and
   * how many are there when its units are split up, or a dash when nothing
   * is filed anywhere.
   *
   * This is what the old equipment.location column was asked for in lists,
   * printouts and pickers. It reads the equipment_rooms view, so it counts
   * the contents of boxes as being in the room the box stands in.
   */
  roomLabel: (equipmentId: string) => string;
  /** Resolve a room name to a room, creating it if it is new. */
  roomIdFor: (name: string) => Promise<string>;
}

const EquipmentContext = createContext<EquipmentContextType | undefined>(undefined);

function sortByName(rows: Equipment[]) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export function EquipmentProvider({ children }: { children: ReactNode }) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [itemRooms, setItemRooms] = useState<ItemRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from("rooms")
      .select("*")
      .order("sort_order")
      .order("name");
    if (fetchError) setError(fetchError.message);
    else setRooms(data ?? []);
  }, []);

  // equipment_rooms is a view, and a view cannot be streamed over realtime,
  // so placement and room events re-read it rather than patching rows.
  const loadItemRooms = useCallback(async () => {
    const { data, error: fetchError } = await supabase.from("equipment_rooms").select("*");
    if (fetchError) setError(fetchError.message);
    else setItemRooms(data ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error: fetchError } = await supabase
        .from("equipment")
        .select("*")
        .order("name", { ascending: true });
      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setEquipment(data ?? []);
      }
      await Promise.all([loadRooms(), loadItemRooms()]);
      if (!active) return;
      setLoading(false);
    }
    load();

    // Realtime keeps every active user's list in sync without a manual
    // refresh — mutations below don't touch local state themselves,
    // they rely on the event this subscription receives.
    // Unique per mount, not a fixed name. removeChannel is asynchronous, so
    // remounting this provider — which happens on every move between the
    // inventory and the boxes pages — could re-subscribe under the same name
    // before the old channel had finished going away, and Supabase throws
    // rather than tolerating that.
    const channel = supabase
      .channel(`equipment-changes-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "equipment" },
        (payload) => {
          setEquipment((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as Equipment;
              if (prev.some((e) => e.id === row.id)) return prev;
              return sortByName([...prev, row]);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Equipment;
              return sortByName(prev.map((e) => (e.id === row.id ? row : e)));
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Equipment;
              return prev.filter((e) => e.id !== oldRow.id);
            }
            return prev;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "equipment_placements" },
        () => {
          void loadItemRooms();
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
        // A rename arrives here. The name lives in one place now, so
        // re-reading is the whole of following it.
        void loadRooms();
        void loadItemRooms();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [loadRooms, loadItemRooms]);

  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);

  const roomsByItem = useMemo(() => groupByItem(itemRooms), [itemRooms]);

  const roomLabel = useCallback(
    (equipmentId: string) => labelFor(roomsByItem.get(equipmentId)),
    [roomsByItem],
  );

  const roomIdFor = useCallback(async (name: string) => {
    const { data, error: rpcError } = await supabase.rpc("room_id_for", { p_name: name });
    if (rpcError) throw rpcError;
    await loadRooms();
    return data;
  }, [loadRooms]);

  async function addEquipment(input: NewEquipment): Promise<Equipment> {
    const { data, error: insertError } = await supabase
      .from("equipment")
      .insert(input)
      .select()
      .single();
    if (insertError) throw insertError;
    return data;
  }

  async function updateEquipment(id: string, patch: EquipmentUpdate) {
    const { error: updateError } = await supabase.from("equipment").update(patch).eq("id", id);
    if (updateError) throw updateError;
  }

  async function deleteEquipment(id: string) {
    const { error: deleteError } = await supabase.from("equipment").delete().eq("id", id);
    if (deleteError) throw deleteError;
  }

  return (
    <EquipmentContext.Provider
      value={{
        equipment,
        rooms,
        roomsById,
        loading,
        error,
        addEquipment,
        updateEquipment,
        deleteEquipment,
        roomLabel,
        roomIdFor,
      }}
    >
      {children}
    </EquipmentContext.Provider>
  );
}

export function useEquipment() {
  const ctx = useContext(EquipmentContext);
  if (!ctx) throw new Error("useEquipment must be used within EquipmentProvider");
  return ctx;
}
