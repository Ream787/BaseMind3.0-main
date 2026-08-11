import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type TableName = keyof Database["public"]["Tables"];
type RowOf<T extends TableName> = Database["public"]["Tables"][T]["Row"];

/**
 * Loads a table and keeps it in sync via postgres_changes, so a change made by
 * one leader shows up for everyone else without a refresh.
 *
 * Mutations go straight to Supabase per row; the realtime event is what updates
 * local state, which avoids the whole-table rewrites the old app did.
 */
export function useRealtimeTable<T extends TableName>(
  table: T,
  options: { orderBy?: keyof RowOf<T> & string; ascending?: boolean } = {},
) {
  const { orderBy, ascending = true } = options;
  const [rows, setRows] = useState<RowOf<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortRows = useCallback(
    (list: RowOf<T>[]) => {
      if (!orderBy) return list;
      return [...list].sort((a, b) => {
        const av = (a as Record<string, unknown>)[orderBy];
        const bv = (b as Record<string, unknown>)[orderBy];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const result =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
        return ascending ? result : -result;
      });
    },
    [orderBy, ascending],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error: fetchError } = await supabase.from(table).select("*");
      if (!active) return;
      if (fetchError) {
        setError(fetchError.message);
      } else {
        setError(null);
        // select("*") resolves to a deeply-inferred query type that doesn't
        // narrow to the plain Row shape, hence the cast through unknown.
        setRows(sortRows((data ?? []) as unknown as RowOf<T>[]));
      }
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`${table}-changes`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        setRows((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as RowOf<T>;
            if (prev.some((r) => idOf(r) === idOf(row))) return prev;
            return sortRows([...prev, row]);
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as RowOf<T>;
            return sortRows(prev.map((r) => (idOf(r) === idOf(row) ? row : r)));
          }
          if (payload.eventType === "DELETE") {
            const row = payload.old as RowOf<T>;
            return prev.filter((r) => idOf(r) !== idOf(row));
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [table, sortRows]);

  return { rows, loading, error, setRows };
}

function idOf(row: unknown): string | undefined {
  return (row as { id?: string })?.id;
}
