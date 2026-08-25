/**
 * Recovery for the "chunk 404 after a deploy" failure.
 *
 * The app is split into lazily-loaded chunks whose filenames contain a build
 * hash. When a new version is deployed, the page a browser already has open
 * still refers to the previous build's filenames — and those are gone, so the
 * next navigation throws "Failed to fetch dynamically imported module" and
 * the whole app falls over.
 *
 * Reloading fixes it, because that fetches the new index.html. The only care
 * needed is not reloading forever if something else is wrong, so an attempt
 * is recorded in sessionStorage and only one reload is allowed per session.
 */

const RELOAD_FLAG = "basemind:reloaded-for-stale-build";

export function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    // Safari's wording when a module 404s.
    /unable to preload css/i.test(message)
  );
}

/** True when a reload has already been tried in this tab. */
export function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === "1";
  } catch {
    return false;
  }
}

export function markReloaded(): void {
  try {
    sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    /* private mode — we just lose the loop guard */
  }
}

export function clearReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}

/**
 * Reloads once to pick up the new build. Returns false when a reload has
 * already been attempted, so the caller can show a real error instead of
 * looping.
 */
export function recoverFromStaleBuild(): boolean {
  if (alreadyReloaded()) return false;
  markReloaded();
  window.location.reload();
  return true;
}

/**
 * Catches chunk failures that happen outside React's error boundary — a
 * hover-triggered prefetch, or a lazy import that rejects between renders.
 */
export function installStaleBuildHandler(): void {
  window.addEventListener("unhandledrejection", (event) => {
    if (isStaleChunkError(event.reason)) {
      event.preventDefault();
      recoverFromStaleBuild();
    }
  });

  window.addEventListener("error", (event) => {
    if (isStaleChunkError(event.error ?? event.message)) {
      recoverFromStaleBuild();
    }
  });
}
