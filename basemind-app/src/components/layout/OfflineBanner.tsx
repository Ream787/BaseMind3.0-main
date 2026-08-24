import { formatDistanceToNow, parseISO } from "date-fns";
import { AlertTriangle, CloudOff, Loader2, RefreshCw, X } from "lucide-react";

import { useOffline } from "@/context/OfflineContext";
import { Button } from "@/components/ui/button";

export function OfflineBanner() {
  const { online, pending, failed, lastSyncedAt, syncing, sync, dismissFailed } = useOffline();

  if (online && pending.length === 0 && failed.length === 0) return null;

  return (
    <div className="flex flex-col">
      {!online && (
        <div className="flex flex-wrap items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <CloudOff className="size-4 shrink-0" />
          <span>
            Offline — showing saved data
            {lastSyncedAt && (
              <> from {formatDistanceToNow(parseISO(lastSyncedAt), { addSuffix: true })}</>
            )}
            . You can still add things; editing is paused until you reconnect.
          </span>
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-secondary px-4 py-2 text-sm text-secondary-foreground">
          {syncing ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <RefreshCw className="size-4 shrink-0" />
          )}
          <span>
            {pending.length} {pending.length === 1 ? "change" : "changes"} waiting to sync
            {!online && " — they'll go up when you're back online"}
          </span>
          {online && !syncing && (
            <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => sync()}>
              Sync now
            </Button>
          )}
        </div>
      )}

      {failed.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-wrap items-center gap-2 bg-destructive/10 px-4 py-2 text-sm"
        >
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span>
            A change to <strong>{entry.table.replace(/_/g, " ")}</strong> was rejected:{" "}
            {entry.failure}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto size-7"
            aria-label="Dismiss"
            onClick={() => dismissFailed(entry.id)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
