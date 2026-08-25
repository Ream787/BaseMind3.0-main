import { useEffect } from "react";
import { useRouteError } from "react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { alreadyReloaded, isStaleChunkError, recoverFromStaleBuild } from "@/lib/staleDeploy";
import { Button } from "@/components/ui/button";

/**
 * Replaces React Router's raw stack trace.
 *
 * The common case by far is a stale build: the app updated while this tab was
 * open, so a chunk it wants no longer exists. That's recovered automatically
 * by reloading, which is invisible to the user. Anything else gets a plain
 * explanation instead of a developer error screen.
 */
export function RouteError() {
  const error = useRouteError();
  const stale = isStaleChunkError(error);
  const recovering = stale && !alreadyReloaded();

  useEffect(() => {
    if (stale) recoverFromStaleBuild();
  }, [stale]);

  if (recovering) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Updating to the latest version…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="size-8 text-destructive" />
      <div className="max-w-md">
        <h1 className="mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          {stale
            ? "The app couldn't finish updating. Reloading again usually sorts it; if not, close the tab and reopen it."
            : "That page failed to load. Reloading usually sorts it."}
        </p>
        {error instanceof Error && (
          <p className="mt-3 break-words rounded-md bg-muted p-2 text-xs text-muted-foreground">
            {error.message}
          </p>
        )}
      </div>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw className="size-4" />
        Reload
      </Button>
    </div>
  );
}
