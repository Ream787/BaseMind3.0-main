export type ChangeEvent<Row> =
  | { eventType: "INSERT"; new: Row }
  | { eventType: "UPDATE"; new: Row }
  | { eventType: "DELETE"; old: Row };

function keyOf<Row>(row: Row, primaryKey: string): unknown {
  return (row as Record<string, unknown> | null)?.[primaryKey];
}

/**
 * Merges one realtime change into a list of rows.
 *
 * The primary key is a parameter because not every table uses `id` —
 * feature_flags is keyed by `key`. Assuming `id` meant every row's key read
 * as undefined, undefined matched undefined, and a single update overwrote
 * the entire table in the UI.
 *
 * A row whose key is missing is therefore ignored rather than matched
 * loosely: doing nothing is recoverable on the next fetch, quietly replacing
 * every row is not.
 */
export function applyRealtimeChange<Row>(
  rows: Row[],
  change: ChangeEvent<Row>,
  primaryKey = "id",
): Row[] {
  if (change.eventType === "INSERT") {
    const incoming = keyOf(change.new, primaryKey);
    if (incoming === undefined) return rows;
    if (rows.some((row) => keyOf(row, primaryKey) === incoming)) return rows;
    return [...rows, change.new];
  }

  if (change.eventType === "UPDATE") {
    const incoming = keyOf(change.new, primaryKey);
    if (incoming === undefined) return rows;
    return rows.map((row) => (keyOf(row, primaryKey) === incoming ? change.new : row));
  }

  const removed = keyOf(change.old, primaryKey);
  if (removed === undefined) return rows;
  return rows.filter((row) => keyOf(row, primaryKey) !== removed);
}
