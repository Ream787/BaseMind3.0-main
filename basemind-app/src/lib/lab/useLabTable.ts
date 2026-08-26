import { useCallback, useEffect, useMemo, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";
import { labDb, classifyLabError, type LabAvailability } from "@/lib/lab/client";
import { idbGet, idbSet } from "@/lib/offline/db";
import { applyRealtimeChange } from "@/lib/applyRealtimeChange";
import type { LabDatabase, LabTableName } from "@/types/lab";

type RowOf<T extends LabTableName> = LabDatabase["lab"]["Tables"][T]["Row"];

/** Namespaced so lab's cache and the app's cache can never collide. */
const cacheKey = (table: string) => `lab:table:${table}`;

/**
 * Makes every subscription's channel name unique.
 *
 * `supabase.channel(topic)` hands back the *existing* channel when one
 * already has that topic, and `removeChannel` is asynchronous. Under
 * React's StrictMode double-mount — and any time two components watch the
 * same table — the second `.on()` lands on a channel that has already
 * subscribed, which throws "cannot add postgres_changes callbacks after
 * subscribe()" and takes the whole tree down with it.
 *
 * A counter is enough: each hook instance gets its own topic, so a mount
 * can never collide with a channel that is still being torn down.
 */
let channelSequence = 0;

/**
 * The lab schema's version of `useRealtimeTable`.
 *
 * Same contract — load once, keep in sync over postgres_changes, fall back
 * to the last known rows when the network is gone — with two differences
 * that come from lab being optional:
 *
 *   * the subscription filters on `schema: "lab"`, because the app's own
 *     channels only listen to `public` and would never hear these;
 *   * a failure is classified rather than shown raw. "Schema not exposed"
 *     is a setup step, not an outage, and telling somebody their network
 *     is down when they have simply not finished installing the branch
 *     wastes an evening.
 *
 * Filtering by a column is supported because several of these tables are
 * per-camp: fetching every attendance row in the group to show one camp's
 * register would work and would also be daft.
 */
export function useLabTable<T extends LabTableName>(
  table: T,
  options: {
    orderBy?: keyof RowOf<T> & string;
    ascending?: boolean;
    primaryKey?: keyof RowOf<T> & string;
    /** Server-side equality filter, e.g. `{ column: "event_id", value: id }`. */
    filter?: { column: keyof RowOf<T> & string; value: string | null } | null;
    /** Skip the query entirely — for a filter whose value is not known yet. */
    enabled?: boolean;
  } = {},
) {
  const {
    orderBy,
    ascending = true,
    primaryKey = "id",
    filter = null,
    enabled = true,
  } = options;

  const [rows, setRows] = useState<RowOf<T>[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [availability, setAvailability] = useState<LabAvailability>({ state: "ready" });

  // Depending on the object identity of `filter` would re-run the effect on
  // every render, since callers write it inline.
  const filterColumn = filter?.column ?? null;
  const filterValue = filter?.value ?? null;

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
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return;
    }

    let active = true;
    // A filtered view gets its own cache entry; otherwise opening one
    // camp's register would leave the whole group's rows cached under the
    // table name and the next camp would flash the wrong list.
    const key = filterColumn ? `${cacheKey(table)}:${filterColumn}:${filterValue}` : cacheKey(table);

    async function load() {
      const cached = await idbGet<RowOf<T>[]>(key);
      if (active && cached?.length) {
        setRows(sortRows(cached));
        setLoading(false);
      }

      let query = labDb.from(table).select("*");
      if (filterColumn) {
        // The query builder types a column name against the row shape of a
        // *known* table, which a generic `T` cannot satisfy. Narrowing the
        // builder to the two methods used keeps that escape hatch to one
        // line; the column itself is still typed at the call site, where
        // the table is concrete.
        const filterable = query as unknown as {
          eq(column: string, value: string): typeof query;
          is(column: string, value: null): typeof query;
        };
        query =
          filterValue === null
            ? filterable.is(filterColumn, null)
            : filterable.eq(filterColumn, filterValue);
      }

      const { data, error } = await query;
      if (!active) return;

      if (error) {
        setAvailability(classifyLabError(error as PostgrestError));
        // With rows already on screen there is nothing useful to say — the
        // offline banner covers it.
        if (!cached?.length) setRows([]);
      } else {
        setAvailability({ state: "ready" });
        const fresh = (data ?? []) as unknown as RowOf<T>[];
        setRows(sortRows(fresh));
        void idbSet(key, fresh);
      }
      setLoading(false);
    }
    void load();

    const channel = supabase
      .channel(`lab-${table}-${(channelSequence += 1)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "lab",
          table,
          ...(filterColumn && filterValue !== null
            ? { filter: `${filterColumn}=eq.${filterValue}` }
            : {}),
        },
        (payload) => {
          setRows((prev) => {
            const change =
              payload.eventType === "DELETE"
                ? ({ eventType: "DELETE", old: payload.old as RowOf<T> } as const)
                : ({ eventType: payload.eventType, new: payload.new as RowOf<T> } as const);
            return sortRows(applyRealtimeChange(prev, change, primaryKey));
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [table, sortRows, primaryKey, filterColumn, filterValue, enabled]);

  const error = availability.state === "error" ? availability.message : null;

  return { rows, loading, error, availability, setRows };
}

/**
 * Index a list of rows by a key, which nearly every page here needs in
 * order to show a name where the database stores an id.
 */
export function useIndexBy<Row, K extends keyof Row>(rows: Row[], key: K) {
  return useMemo(() => {
    const map = new Map<Row[K], Row>();
    for (const row of rows) map.set(row[key], row);
    return map;
  }, [rows, key]);
}
