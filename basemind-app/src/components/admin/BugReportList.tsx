import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import type { BugStatus } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES: BugStatus[] = ["Open", "Looking at it", "Fixed", "Not a bug"];

const statusStyles: Record<BugStatus, string> = {
  Open: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
  "Looking at it":
    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
  Fixed:
    "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900",
  "Not a bug":
    "bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
};

/** Open first, then newest — the list is a queue, not an archive. */
const RANK: Record<BugStatus, number> = {
  Open: 0,
  "Looking at it": 1,
  Fixed: 2,
  "Not a bug": 3,
};

/**
 * What people have reported, and what was done about it.
 *
 * Closed reports stay on the list rather than disappearing: "we know, it's
 * fixed" is the answer to the next person about to report the same thing,
 * and a queue that empties itself teaches everyone that reporting achieves
 * nothing.
 */
export function BugReportList() {
  const { rows: reports, loading } = useRealtimeTable("bug_reports", {
    orderBy: "created_at",
    ascending: false,
  });
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");

  useEffect(() => {
    void supabase
      .from("users")
      .select("id, name")
      .then(({ data }) => setNames(new Map((data ?? []).map((u) => [u.id, u.name]))));
  }, []);

  const sorted = useMemo(
    () =>
      [...reports].sort(
        (a, b) => RANK[a.status] - RANK[b.status] || b.created_at.localeCompare(a.created_at),
      ),
    [reports],
  );

  const openCount = reports.filter((r) => r.status === "Open").length;

  async function setStatus(id: string, status: BugStatus) {
    setBusy(id);
    const { error } = await supabase.from("bug_reports").update({ status }).eq("id", id);
    setBusy(null);
    if (error) toast.error(error.message);
  }

  async function saveNote(id: string) {
    setBusy(id);
    const { error } = await supabase
      .from("bug_reports")
      .update({ resolution: draftNote.trim() || null })
      .eq("id", id);
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success("Note saved");
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading reports…</p>;
  }

  if (reports.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Check className="size-4 shrink-0" />
        Nothing reported yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {openCount === 0
          ? `${reports.length} ${reports.length === 1 ? "report" : "reports"}, none open.`
          : `${openCount} open of ${reports.length}.`}
      </p>

      <ul className="flex flex-col gap-2">
        {sorted.map((report) => {
          const expanded = openId === report.id;
          const who = report.reported_by ? names.get(report.reported_by) ?? "Unknown" : "Someone";
          return (
            <li key={report.id} className="rounded-lg border bg-card">
              <button
                type="button"
                className="flex w-full items-start gap-2 p-3 text-left"
                onClick={() => {
                  setOpenId(expanded ? null : report.id);
                  setDraftNote(report.resolution ?? "");
                }}
              >
                {expanded ? (
                  <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words font-medium">{report.summary}</span>
                  <span className="text-xs text-muted-foreground">
                    {who} · {format(parseISO(report.created_at), "d MMM yyyy")}
                    {report.page && ` · ${report.page}`}
                  </span>
                </span>
                <Badge
                  variant="outline"
                  className={cn("shrink-0", statusStyles[report.status])}
                >
                  {report.status}
                </Badge>
              </button>

              {expanded && (
                <div className="flex flex-col gap-3 border-t p-3 text-sm">
                  {report.detail && (
                    <p className="whitespace-pre-wrap break-words">{report.detail}</p>
                  )}

                  <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {Object.entries(report.context ?? {}).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <dt className="w-28 shrink-0">{key}</dt>
                        <dd className="min-w-0 break-words">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={report.status}
                      onValueChange={(v) => setStatus(report.id, v as BugStatus)}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {report.resolved_at && (
                      <span className="text-xs text-muted-foreground">
                        closed {format(parseISO(report.resolved_at), "d MMM yyyy")}
                      </span>
                    )}
                  </div>

                  {/* The reporter can read this: it is the only way they
                      find out their report went anywhere. */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="What was done about it…"
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={busy === report.id || draftNote === (report.resolution ?? "")}
                      onClick={() => saveNote(report.id)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
