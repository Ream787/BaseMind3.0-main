/**
 * Queue of rows added while offline, replayed when the connection returns.
 *
 * Only inserts are queued. Edits and deletes are blocked offline on purpose:
 * two people adding different rows never collide, but two people editing the
 * same row do, and resolving that silently would mean quietly discarding
 * somebody's work. Insert-only keeps sync honest without a merge strategy.
 *
 * Every queued row carries a client-generated UUID, which makes replay
 * idempotent: if a row reaches the server and the reply is lost, retrying
 * fails on the primary key rather than creating a duplicate, and that is
 * treated as success.
 */

export type OutboxEntry = {
  /** The row's primary key, generated up front so replay can't duplicate it. */
  id: string;
  table: string;
  row: Record<string, unknown>;
  queuedAt: string;
  /** Set once a replay has failed in a way retrying won't fix. */
  failure?: string;
};

export type ReplayOutcome = {
  synced: OutboxEntry[];
  /** Permanently rejected — kept so the user can be told, not dropped. */
  failed: OutboxEntry[];
  /** Still queued: no connection, or the session needs renewing. */
  remaining: OutboxEntry[];
};

export type InsertResult = { error: { message: string; code?: string } | null };

/** Postgres duplicate-key. The row is already there, so the job is done. */
const DUPLICATE_KEY = "23505";

/**
 * Errors worth keeping in the queue for later rather than discarding.
 * Anything else (a constraint violation, an RLS refusal) will fail the same
 * way every time, so it's surfaced instead of retried forever.
 */
function isTransient(error: { message: string; code?: string }): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("jwt") ||
    message.includes("token") ||
    error.code === "PGRST301" || // JWT expired
    error.code === "503" ||
    error.code === "504"
  );
}

export async function replayOutbox(
  entries: OutboxEntry[],
  insert: (table: string, row: Record<string, unknown>) => Promise<InsertResult>,
): Promise<ReplayOutcome> {
  const synced: OutboxEntry[] = [];
  const failed: OutboxEntry[] = [];
  const remaining: OutboxEntry[] = [];

  for (const entry of entries) {
    // Once one entry is stuck on the network, the rest will be too — leave
    // them queued in order rather than hammering a dead connection.
    if (remaining.length > 0) {
      remaining.push(entry);
      continue;
    }

    let result: InsertResult;
    try {
      result = await insert(entry.table, { id: entry.id, ...entry.row });
    } catch (err) {
      remaining.push(entry);
      void err;
      continue;
    }

    if (!result.error) {
      synced.push(entry);
    } else if (result.error.code === DUPLICATE_KEY) {
      // Already made it last time; the reply just never arrived.
      synced.push(entry);
    } else if (isTransient(result.error)) {
      remaining.push(entry);
    } else {
      failed.push({ ...entry, failure: result.error.message });
    }
  }

  return { synced, failed, remaining };
}

/** Browser UUID, with a fallback for older or non-secure contexts. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
