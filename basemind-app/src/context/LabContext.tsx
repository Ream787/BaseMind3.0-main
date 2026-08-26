import { createContext, useContext, type ReactNode } from "react";

import { useLabTable } from "@/lib/lab/useLabTable";
import type { LabAvailability } from "@/lib/lab/client";
import type { LabFeatureFlag, LabFeatureKey } from "@/types/lab";

interface LabContextType {
  /** Whether the lab schema is installed, exposed and reachable. */
  availability: LabAvailability;
  installed: boolean;
  loading: boolean;
  isEnabled: (key: LabFeatureKey) => boolean;
  flags: LabFeatureFlag[];
}

const LabContext = createContext<LabContextType | undefined>(undefined);

/**
 * Whether the extra half of the app is switched on, and which parts of it.
 *
 * This deliberately fails *closed*, which is the opposite of
 * `FeaturesContext`. There, an unreadable flags table means showing a
 * section somebody had turned off — annoying. Here, an unreadable flags
 * table usually means the lab schema is not installed at all, and failing
 * open would fill the nav with twenty links that every one of them errors.
 * So: no flags, no lab.
 *
 * The one exception is a flag row that has not been created yet, for a
 * feature added after the migration was run. That defaults to on, because
 * at that point the schema clearly does exist.
 */
export function LabProvider({ children }: { children: ReactNode }) {
  const { rows: flags, loading, availability } = useLabTable("feature_flags", {
    orderBy: "sort_order",
    primaryKey: "key",
  });

  const installed = availability.state === "ready" && !loading;

  function isEnabled(key: LabFeatureKey) {
    if (availability.state !== "ready") return false;
    const flag = flags.find((f) => f.key === key);
    return flag ? flag.enabled : true;
  }

  return (
    <LabContext.Provider value={{ availability, installed, loading, isEnabled, flags }}>
      {children}
    </LabContext.Provider>
  );
}

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useLab must be used within LabProvider");
  return ctx;
}
