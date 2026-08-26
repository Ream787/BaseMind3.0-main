import type { ReactNode } from "react";
import { Link } from "react-router";
import { Database, PowerOff, PlugZap, WifiOff } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useLab } from "@/context/LabContext";
import { Button } from "@/components/ui/button";
import { SectionTabs, type SectionTab } from "@/components/layout/SectionTabs";
import type { LabFeatureKey } from "@/types/lab";

/**
 * Explains why a lab page is blank, in the terms of whichever step is
 * actually missing.
 *
 * Three different problems produce the same empty screen — the SQL has not
 * been run, the schema has not been exposed to the API, or the network is
 * down — and they have three completely different fixes. Guessing costs an
 * evening; naming the one that applies costs a paragraph.
 */
export function LabSetupNotice() {
  const { availability } = useLab();

  if (availability.state === "ready") return null;

  if (availability.state === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <WifiOff className="size-6 text-muted-foreground" />
        <div>
          <p className="font-medium">Can&apos;t reach the extra features</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{availability.message}</p>
        </div>
      </div>
    );
  }

  const notExposed = availability.state === "not-exposed";

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-dashed p-6 sm:p-10">
      <div className="flex flex-col items-center gap-3 text-center">
        {notExposed ? (
          <PlugZap className="size-7 text-muted-foreground" />
        ) : (
          <Database className="size-7 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">
            {notExposed
              ? "The lab schema isn't being served by the API"
              : "The lab schema hasn't been installed yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {notExposed
              ? "It exists in the database, but PostgREST hasn't been told to serve it. One dropdown fixes this."
              : "These pages live in a separate Postgres schema so they can be added — and removed — without touching equipment, camps or food."}
          </p>
        </div>
      </div>

      <ol className="mt-6 space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
            1
          </span>
          <span>
            In the Supabase SQL editor, run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              supabase/lab/0001_lab_schema.sql
            </code>
            , then{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              supabase/lab/0002_lab_functions.sql
            </code>
            .
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
            2
          </span>
          <span>
            Project Settings → API → <strong>Exposed schemas</strong>: add{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">lab</code> next to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">public</code>. Without this the
            API refuses the schema however correct the tables are.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
            3
          </span>
          <span>
            Optionally run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              supabase/lab/0003_lab_seed.sql
            </code>{" "}
            for demonstration data, then reload this page.
          </span>
        </li>
      </ol>

      <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">
        Changed your mind? <code className="rounded bg-muted px-1 py-0.5 text-xs">drop_lab.sql</code>{" "}
        removes every one of these tables and leaves the rest of BaseMind exactly as it was.
      </p>
    </div>
  );
}

/**
 * A lab page that has been switched off in Admin settings.
 *
 * Same reasoning as `RequireFeature`: explain rather than redirect, so a
 * bookmark tells you what happened instead of dumping you somewhere else.
 */
function LabFeatureOff() {
  const { profile } = useAuth();

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

/**
 * The standard shell for a lab page: tabs, a heading, an actions slot, and
 * the three "why is this blank" cases handled once instead of twenty times.
 */
export function LabPage({
  title,
  description,
  feature,
  tabs,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  feature?: LabFeatureKey;
  tabs?: SectionTab[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { availability, loading, isEnabled } = useLab();

  const body = (() => {
    // Still checking. Showing the setup instructions here would flash
    // "not installed" at somebody whose schema is perfectly fine.
    if (loading && availability.state === "ready") {
      return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;
    }
    if (availability.state !== "ready") return <LabSetupNotice />;
    if (feature && !isEnabled(feature)) return <LabFeatureOff />;
    return children;
  })();

  return (
    <div className="space-y-4">
      {tabs && <SectionTabs tabs={tabs} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {availability.state === "ready" && actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {body}
    </div>
  );
}
