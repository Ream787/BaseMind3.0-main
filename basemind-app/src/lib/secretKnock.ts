import { useCallback, useRef } from "react";
import { useNavigate } from "react-router";

/** How many taps on the wordmark open the maze. */
export const TAPS_REQUIRED = 10;

/**
 * The taps have to be a deliberate run, not ten over an afternoon, so the
 * count resets if you pause. Two seconds is slow enough to tap ten times
 * without hurrying and short enough that idle prodding never gets there.
 */
export const RESET_AFTER_MS = 2000;

/**
 * Ten taps on the wordmark, and only then.
 *
 * A hook rather than inline state because the counter has to survive
 * re-renders of the header without leaking a timer: the ref keeps the run,
 * and the timeout is always cleared before a new one is set.
 */
export function useSecretKnock(
  taps = TAPS_REQUIRED,
  windowMs = RESET_AFTER_MS,
): () => void {
  const navigate = useNavigate();
  const count = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    count.current += 1;

    // Every tap goes home — that is what a wordmark is for, and it keeps the
    // egg hidden: nine taps look exactly like nine people going home.
    navigate("/home");

    if (count.current >= taps) {
      count.current = 0;
      timer.current = null;
      navigate("/maze");
      return;
    }

    timer.current = setTimeout(() => {
      count.current = 0;
      timer.current = null;
    }, windowMs);
  }, [navigate, taps, windowMs]);
}
