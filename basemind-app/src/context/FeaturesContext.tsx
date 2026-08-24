import { createContext, useContext, type ReactNode } from "react";

import { useRealtimeTable } from "@/lib/useRealtimeTable";
import type { FeatureFlag, FeatureKey } from "@/types/database";

interface FeaturesContextType {
  flags: FeatureFlag[];
  loading: boolean;
  isEnabled: (key: FeatureKey) => boolean;
}

const FeaturesContext = createContext<FeaturesContextType | undefined>(undefined);

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const { rows: flags, loading } = useRealtimeTable("feature_flags", { orderBy: "sort_order" });

  /**
   * Unknown or not-yet-loaded features default to on.
   *
   * Failing open matters here: if the flags table can't be read — offline
   * before it was ever cached, or the migration hasn't been run — hiding the
   * whole app would be far worse than showing a section someone turned off.
   */
  function isEnabled(key: FeatureKey) {
    const flag = flags.find((f) => f.key === key);
    return flag ? flag.enabled : true;
  }

  return (
    <FeaturesContext.Provider value={{ flags, loading, isEnabled }}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures() {
  const ctx = useContext(FeaturesContext);
  if (!ctx) throw new Error("useFeatures must be used within FeaturesProvider");
  return ctx;
}
