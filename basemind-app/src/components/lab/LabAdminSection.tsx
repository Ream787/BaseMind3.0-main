import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

import { useLab } from "@/context/LabContext";
import { useOffline } from "@/context/OfflineContext";
import { labDb } from "@/lib/lab/client";
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
import { LabSetupNotice } from "@/components/lab/LabPage";
import type { LabFeatureKey } from "@/types/lab";

/**
 * The lab schema's own switches, on the admin page beside the app's.
 *
 * Two lists rather than one, and labelled as two, because they are backed
 * by two tables in two schemas with two different lifetimes. Merging them
 * into one list would look tidier right up until somebody ran
 * `drop_lab.sql` and half the switches vanished with no explanation.
 */
export function LabAdminSection() {
  const { flags, loading, availability } = useLab();
  const { online } = useOffline();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState<{ key: LabFeatureKey; label: string } | null>(
    null,
  );

  async function setEnabled(key: LabFeatureKey, enabled: boolean) {
    setBusy(key);
    const { error } = await labDb.from("feature_flags").update({ enabled }).eq("key", key);
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(enabled ? "Turned on" : "Turned off for everyone");
  }

  /**
   * Turning something off takes it away from everyone, so it asks first;
   * turning it back on restores things and does not. Same asymmetry as the
   * app's own switches — making both directions equally hard would only
   * train people to click through the dialog.
   */
  function requestToggle(flag: { key: LabFeatureKey; label: string }, next: boolean) {
    if (next) void setEnabled(flag.key, true);
    else setConfirmOff({ key: flag.key, label: flag.label });
  }

  const off = flags.filter((f) => !f.enabled).length;

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          <FlaskConical className="size-4 text-muted-foreground" />
          Extra features
        </h2>
        <p className="text-sm text-muted-foreground">
          Members, progression, camp tasks, the noticeboard and the rest live in a separate{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">lab</code> schema, with their own
          switches. Turning one off hides its page for everyone and leaves its data alone —
          exactly like the switches above.
        </p>
      </div>

      {availability.state !== "ready" ? (
        <LabSetupNotice />
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="rounded-lg border">
            {flags.map((flag) => (
              <div key={flag.key} className="flex items-center gap-4 border-b p-4 last:border-b-0">
                <div className="flex min-w-0 flex-col">
                  <label htmlFor={`lab-flag-${flag.key}`} className="font-medium">
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
                    id={`lab-flag-${flag.key}`}
                    checked={flag.enabled}
                    disabled={!online || busy === flag.key}
                    onCheckedChange={(next) => requestToggle(flag, next)}
                    aria-label={`${flag.label} — currently ${flag.enabled ? "on" : "off"}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            {off > 0 && `${off} switched off. `}
            To remove all of this permanently, run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/lab/drop_lab.sql</code>{" "}
            — it drops the whole schema and leaves equipment, camps and food untouched.
          </p>
        </>
      )}

      <AlertDialog open={!!confirmOff} onOpenChange={(open) => !open && setConfirmOff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off {confirmOff?.label} for everyone?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides {confirmOff?.label} for <strong>every user in the group</strong>, not
              just you.
              <br />
              <br />
              Nothing is deleted. The rows stay in the <code>lab</code> schema and come back
              untouched when you switch it on again.
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
    </section>
  );
}
