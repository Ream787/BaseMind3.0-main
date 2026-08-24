import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";

/**
 * Splits "can write" into adding and changing, because they behave
 * differently offline.
 *
 * Adding queues safely: two people adding different rows never collide.
 * Editing and deleting the same row does collide, and resolving that without
 * asking would mean quietly discarding someone's work — so they're paused
 * until there's a connection to check against.
 */
export function useWritePermissions() {
  const { hasRole } = useAuth();
  const { online } = useOffline();

  const isContributor = hasRole(["Admin", "Manager", "Member"]);
  const isManager = hasRole(["Admin", "Manager"]);

  return {
    /** Allowed offline — queued and replayed on reconnect. */
    canAdd: isContributor,
    /** Requires a connection. */
    canEdit: isContributor && online,
    canDelete: isManager && online,
    /** True when a control is hidden only because there's no connection. */
    blockedByOffline: isContributor && !online,
    online,
  };
}
