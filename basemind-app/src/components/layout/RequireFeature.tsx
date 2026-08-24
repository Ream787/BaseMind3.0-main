import type { ReactNode } from "react";
import { Link } from "react-router";
import { PowerOff } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useFeatures } from "@/context/FeaturesContext";
import { Button } from "@/components/ui/button";
import type { FeatureKey } from "@/types/database";

/**
 * Hides a page whose feature has been switched off.
 *
 * This shows an explanation rather than redirecting: someone following an old
 * link or a bookmark should learn the feature was turned off, not silently
 * land somewhere else and wonder what happened.
 */
export function RequireFeature({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { isEnabled, loading } = useFeatures();
  const { profile } = useAuth();

  if (loading) return null;
  if (isEnabled(feature)) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <PowerOff className="size-6 text-muted-foreground" />
      <div>
        <p className="font-medium">This feature is switched off</p>
        <p className="text-sm text-muted-foreground">
          An admin has turned it off. Its data is untouched and comes back if it&apos;s turned on
          again.
        </p>
      </div>
      {profile?.role === "Admin" && (
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin">Manage features</Link>
        </Button>
      )}
    </div>
  );
}
