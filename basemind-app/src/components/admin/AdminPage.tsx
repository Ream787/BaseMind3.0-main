import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useFeatures } from "@/context/FeaturesContext";
import { useOffline } from "@/context/OfflineContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { FeatureKey } from "@/types/database";

export function AdminPage() {
  const { flags, loading } = useFeatures();
  const { online } = useOffline();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(key: FeatureKey, enabled: boolean) {
    setBusy(key);
    const { error } = await supabase.from("feature_flags").update({ enabled }).eq("key", key);
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(enabled ? "Feature turned on" : "Feature turned off");
  }

  const disabledCount = flags.filter((f) => !f.enabled).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1>Admin</h1>
        <p className="text-sm text-muted-foreground">Settings only admins can change.</p>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Features</h2>
          <p className="text-sm text-muted-foreground">
            Turn off anything your group doesn&apos;t use, or that&apos;s misbehaving. Turning a
            feature off hides its page and menu item for everyone — the data stays where it is and
            comes back untouched when you turn it on again.
          </p>
        </div>

        {!online && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            You&apos;re offline, so these can&apos;t be changed right now.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading features…</p>
        ) : flags.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              No feature switches found. If you haven&apos;t run migration
              <code className="mx-1">0008_feature_flags.sql</code> yet, everything stays switched
              on until you do.
            </span>
          </div>
        ) : (
          <div className="rounded-lg border">
            {flags.map((flag) => (
              <label
                key={flag.key}
                className="flex cursor-pointer items-start gap-3 border-b p-4 last:border-b-0 hover:bg-accent/40"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={flag.enabled}
                  disabled={!online || busy === flag.key}
                  onCheckedChange={(v) => toggle(flag.key, v === true)}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{flag.label}</span>
                  {flag.description && (
                    <span className="text-sm text-muted-foreground">{flag.description}</span>
                  )}
                </span>
                <span className="ml-auto shrink-0 self-center text-xs text-muted-foreground">
                  {flag.enabled ? "On" : "Off"}
                </span>
              </label>
            ))}
          </div>
        )}

        {disabledCount > 0 && (
          <p className="text-sm text-muted-foreground">
            {disabledCount} {disabledCount === 1 ? "feature is" : "features are"} switched off.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t pt-6">
        <h2 className="font-medium">People</h2>
        <p className="text-sm text-muted-foreground">
          Approving new accounts and changing roles lives on its own page.
        </p>
        <Button variant="outline" className="self-start" asChild>
          <Link to="/users">
            <Users className="size-4" />
            Manage users
          </Link>
        </Button>
      </section>
    </div>
  );
}
