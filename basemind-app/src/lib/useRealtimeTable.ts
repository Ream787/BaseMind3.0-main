import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { idbGet, idbSet } from "@/lib/offline/db";
import { applyRealtimeChange } from "@/lib/applyRealtimeChange";
import type { Database } from "@/types/database";

const cacheKey = (table: string) => `table:${table}`;

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
  options: {
    orderBy?: keyof RowOf<T> & string;
    ascending?: boolean;
    /** Column identifying a row. Not every table uses "id". */
    primaryKey?: keyof RowOf<T> & string;
  } = {},
) {
  const { orderBy, ascending = true, primaryKey = "id" } = options;
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
      // Show the last known data straight away. At camp this is often the
      // only data there is, and even on a good connection it beats a spinner.
      const cached = await idbGet<RowOf<T>[]>(cacheKey(table));
      if (active && cached?.length) {
        setRows(sortRows(cached));
        setLoading(false);
      }

      const { data, error: fetchError } = await supabase.from(table).select("*");
      if (!active) return;

      if (fetchError) {
        // With a cache to fall back on this isn't an error the user can act
        // on — the offline banner already explains the situation.
        if (!cached?.length) setError(fetchError.message);
      } else {
        setError(null);
        // select("*") resolves to a deeply-inferred query type that doesn't
        // narrow to the plain Row shape, hence the cast through unknown.
        const fresh = (data ?? []) as unknown as RowOf<T>[];
        setRows(sortRows(fresh));
        void idbSet(cacheKey(table), fresh);
      }
      setLoading(false);
    }
    load();

    // The channel name has to be unique per hook instance, not per table.
    // Supabase throws "cannot add postgres_changes callbacks after
    // subscribe()" when a second caller opens a channel of the same name,
    // so two components reading one table on the same screen — a list and a
    // detail panel, say — would take the page down.
    const channel = supabase
      .channel(`${table}-changes-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        setRows((prev) => {
          const change =
            payload.eventType === "DELETE"
              ? ({ eventType: "DELETE", old: payload.old as RowOf<T> } as const)
              : ({
                  eventType: payload.eventType,
                  new: payload.new as RowOf<T>,
                } as const);
          return sortRows(applyRealtimeChange(prev, change, primaryKey));
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [table, sortRows, primaryKey]);

  return { rows, loading, error, setRows };
}
