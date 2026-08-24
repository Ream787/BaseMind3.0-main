import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { idbGet, idbSet } from "@/lib/offline/db";
import { newId, replayOutbox, type OutboxEntry } from "@/lib/offline/outbox";

const OUTBOX_KEY = "outbox";
const SYNCED_AT_KEY = "last-synced-at";

interface OfflineContextType {
  online: boolean;
  /** Rows added on this device that haven't reached the server yet. */
  pending: OutboxEntry[];
  /** Rows the server refused permanently; shown so they aren't lost silently. */
  failed: OutboxEntry[];
  lastSyncedAt: string | null;
  syncing: boolean;
  /** Queues a row when offline, or inserts it directly when online. */
  addRow: (table: string, row: Record<string, unknown>) => Promise<{ error: string | null }>;
  sync: () => Promise<void>;
  dismissFailed: (id: string) => void;
  markSynced: () => void;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState<OutboxEntry[]>([]);
  const [failed, setFailed] = useState<OutboxEntry[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Held in a ref too so sync() can read the queue without being re-created
  // on every change, which would restart the reconnect effect.
  const pendingRef = useRef<OutboxEntry[]>([]);
  const syncingRef = useRef(false);

  const savePending = useCallback(async (entries: OutboxEntry[]) => {
    pendingRef.current = entries;
    setPending(entries);
    await idbSet(OUTBOX_KEY, entries);
  }, []);

  useEffect(() => {
    idbGet<OutboxEntry[]>(OUTBOX_KEY).then((stored) => {
      if (stored?.length) {
        pendingRef.current = stored;
        setPending(stored);
      }
    });
    idbGet<string>(SYNCED_AT_KEY).then((at) => at && setLastSyncedAt(at));
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current || pendingRef.current.length === 0) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      const outcome = await replayOutbox(pendingRef.current, async (table, row) => {
        const { error } = await supabase
          .from(table as never)
          .insert(row as never);
        return { error: error ? { message: error.message, code: error.code } : null };
      });

      await savePending(outcome.remaining);

      if (outcome.failed.length > 0) {
        setFailed((prev) => [...prev, ...outcome.failed]);
      }
      if (outcome.synced.length > 0) {
        const at = new Date().toISOString();
        setLastSyncedAt(at);
        await idbSet(SYNCED_AT_KEY, at);
        toast.success(
          `Synced ${outcome.synced.length} ${outcome.synced.length === 1 ? "change" : "changes"}`,
        );
      }
      if (outcome.failed.length > 0) {
        toast.error(
          `${outcome.failed.length} ${outcome.failed.length === 1 ? "change was" : "changes were"} rejected by the server`,
        );
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [savePending]);

  useEffect(() => {
    function goOnline() {
      setOnline(true);
      // Give the connection a moment to actually settle before replaying.
      setTimeout(() => void sync(), 1000);
    }
    function goOffline() {
      setOnline(false);
    }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if (navigator.onLine) void sync();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [sync]);

  const addRow = useCallback<OfflineContextType["addRow"]>(
    async (table, row) => {
      if (navigator.onLine) {
        const { error } = await supabase.from(table as never).insert(row as never);
        if (!error) return { error: null };
        // A genuine rejection (RLS, constraint) should surface now rather than
        // being queued to fail again later.
        const looksOffline = /fetch|network|timeout/i.test(error.message);
        if (!looksOffline) return { error: error.message };
      }

      const entry: OutboxEntry = {
        id: newId(),
        table,
        row,
        queuedAt: new Date().toISOString(),
      };
      await savePending([...pendingRef.current, entry]);
      return { error: null };
    },
    [savePending],
  );

  const dismissFailed = useCallback((id: string) => {
    setFailed((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const markSynced = useCallback(() => {
    const at = new Date().toISOString();
    setLastSyncedAt(at);
    void idbSet(SYNCED_AT_KEY, at);
  }, []);

  return (
    <OfflineContext.Provider
      value={{ online, pending, failed, lastSyncedAt, syncing, addRow, sync, dismissFailed, markSynced }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}
