import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";
import type { LabDatabase } from "@/types/lab";

/**
 * The `lab` schema, reached through the app's existing client.
 *
 * A second `createClient` would have been the obvious way to do this, and
 * it is a trap: two clients against the same project each spin up their
 * own auth listener over the same storage key, and they race on token
 * refresh. One client, one session, one socket — this just points the
 * query builder at a different schema.
 *
 * The cast is the price. The runtime call is `schema("lab")` either way;
 * `Database` in `database.ts` describes only `public`, so TypeScript has
 * to be told that this handle sees a different set of tables. Keeping the
 * two type surfaces apart is the point — see the note in `types/lab.ts`.
 */
export const labDb = (supabase as unknown as SupabaseClient<LabDatabase, "lab">).schema("lab");

/**
 * PostgREST's code for "that schema is not one I serve".
 *
 * It is the single most likely thing to go wrong with this branch, and it
 * is not a bug: the schema exists, the tables exist, the grants are right,
 * and the API still refuses because `lab` has not been added to Exposed
 * schemas in the dashboard. Recognising it by code lets the app say that,
 * instead of showing twenty pages of "failed to fetch".
 */
const SCHEMA_NOT_EXPOSED = "PGRST106";

/** Missing table — the schema is served but the migration has not been run. */
const UNDEFINED_TABLE = "42P01";

export type LabAvailability =
  | { state: "ready" }
  /** Schema not in the API's exposed list. Fixable in the dashboard. */
  | { state: "not-exposed" }
  /** API is serving the schema, but the tables are not there yet. */
  | { state: "not-installed" }
  /** Something else — no connection, most likely. */
  | { state: "error"; message: string };

export function classifyLabError(error: PostgrestError | null): LabAvailability {
  if (!error) return { state: "ready" };
  if (error.code === SCHEMA_NOT_EXPOSED) return { state: "not-exposed" };
  if (error.code === UNDEFINED_TABLE) return { state: "not-installed" };
  // PostgREST reports a missing schema in more than one shape depending on
  // version, so fall back to reading the message before giving up.
  const message = `${error.message} ${error.hint ?? ""}`.toLowerCase();
  if (message.includes("schema") && message.includes("must be one of")) {
    return { state: "not-exposed" };
  }
  return { state: "error", message: error.message };
}

/**
 * Money is stored in minor units and shown in major ones. Doing that
 * conversion inline at every call site is how a budget page ends up
 * showing £2,145,000 for a food shop.
 */
export function formatMoney(cents: number, currency = "£") {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${currency}${(abs / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "12.50" or "12,50" or "£12.50" -> 1250. Anything unreadable -> 0. */
export function parseMoney(input: string): number {
  const cleaned = input.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
