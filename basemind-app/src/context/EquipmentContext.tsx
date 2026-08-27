import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/lib/supabase/client";
import type { Equipment, NewEquipment, EquipmentUpdate } from "@/types/database";

interface EquipmentContextType {
  equipment: Equipment[];
  loading: boolean;
  error: string | null;
  addEquipment: (input: NewEquipment) => Promise<void>;
  updateEquipment: (id: string, patch: EquipmentUpdate) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
}

const EquipmentContext = createContext<EquipmentContextType | undefined>(undefined);

function sortByName(rows: Equipment[]) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

export function EquipmentProvider({ children }: { children: ReactNode }) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function addEquipment(input: NewEquipment) {
    const { error: insertError } = await supabase.from("equipment").insert(input);
    if (insertError) throw insertError;
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
      value={{ equipment, loading, error, addEquipment, updateEquipment, deleteEquipment }}
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
