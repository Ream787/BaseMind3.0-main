import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useFeatures } from "@/context/FeaturesContext";
import { useOffline } from "@/context/OfflineContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { FeatureFlag, FeatureKey } from "@/types/database";
import { MazeLeaderboard } from "@/components/admin/MazeLeaderboard";

export function AdminPage() {
  const { flags, loading } = useFeatures();
  const { online } = useOffline();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState<FeatureFlag | null>(null);

  async function setEnabled(key: FeatureKey, enabled: boolean) {
    setBusy(key);
    const { error } = await supabase.from("feature_flags").update({ enabled }).eq("key", key);
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(enabled ? "Feature turned on" : "Feature turned off for everyone");
  }

  /**
   * Turning something off takes it away from everyone, so it asks first.
   * Turning it back on restores things and needs no confirmation — making
   * both directions equally hard would just train people to click through.
   */
  function requestToggle(flag: FeatureFlag, next: boolean) {
    if (next) void setEnabled(flag.key, true);
    else setConfirmOff(flag);
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
              <div
                key={flag.key}
                className="flex items-center gap-4 border-b p-4 last:border-b-0"
              >
                <div className="flex min-w-0 flex-col">
                  <label htmlFor={`flag-${flag.key}`} className="font-medium">
                    {flag.label}
                  </label>
                  {flag.description && (
                    <span className="text-sm text-muted-foreground">{flag.description}</span>
                  )}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <span
                    className={`text-xs ${
                      flag.enabled ? "text-muted-foreground" : "font-medium text-foreground"
                    }`}
                  >
                    {flag.enabled ? "On" : "Off"}
                  </span>
                  <Switch
                    id={`flag-${flag.key}`}
                    checked={flag.enabled}
                    disabled={!online || busy === flag.key}
                    onCheckedChange={(next) => requestToggle(flag, next)}
                    aria-label={`${flag.label} — currently ${flag.enabled ? "on" : "off"}`}
                  />
                </div>
              </div>
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

      <AlertDialog open={!!confirmOff} onOpenChange={(open) => !open && setConfirmOff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off {confirmOff?.label} for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides {confirmOff?.label} for <strong>every user in the group</strong>, not just
              you — its page and menu item disappear for all of them, and anyone with it open will
              lose it as soon as their app updates.
              <br />
              <br />
              Nothing is deleted. All the data stays exactly as it is and comes back untouched
              when you switch it on again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmOff) void setEnabled(confirmOff.key, false);
                setConfirmOff(null);
              }}
            >
              Turn it off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renders nothing until somebody has actually finished the maze. */}
      <MazeLeaderboard />
    </div>
  );
}
