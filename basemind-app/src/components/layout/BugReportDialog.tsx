import { useEffect, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { useLocation } from "react-router";
import { Bug, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import type { BugReport } from "@/types/database";
import { useAuth } from "@/context/AuthContext";
import { useOffline } from "@/context/OfflineContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * What the browser can say about itself that a report is useless without.
 *
 * Collected rather than asked for: "which browser?" is the question every
 * report needs answered and the one nobody thinks to answer. Kept to what
 * actually helps — no fingerprinting, no plugin list, nothing that isn't
 * about why a button didn't work.
 */
function collectContext(online: boolean) {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${window.screen.width}×${window.screen.height}`,
    pixelRatio: window.devicePixelRatio,
    online,
    // Whether they are running the app installed to the home screen, which
    // changes enough about how it behaves to be worth knowing.
    standalone:
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true,
    reportedAt: new Date().toISOString(),
  };
}

/**
 * "This is broken", with the boring parts filled in.
 *
 * Reachable from the account menu on every page, because the moment somebody
 * is willing to report a thing is the moment it has just happened to them.
 * The page they were on goes with it automatically — most reports name a
 * screen by a description that matches three of them.
 */
export function BugReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile } = useAuth();
  const { online } = useOffline();
  const location = useLocation();
  const [summary, setSummary] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<BugReport[]>([]);

  // The page is captured when the dialog opens, not when it is sent: by then
  // it is always this dialog's own route, which tells nobody anything.
  const [page, setPage] = useState("");
  useEffect(() => {
    if (open) {
      setPage(`${location.pathname}${location.search}`);
      setSent(false);
    }
  }, [open, location.pathname, location.search]);

  /**
   * What they have reported before, and what came of it.
   *
   * Without this, reporting a bug is shouting into a cupboard: you never
   * learn whether anybody read it, so you stop bothering. Row-level security
   * limits this to their own reports.
   */
  useEffect(() => {
    if (!open || !profile) return;
    void supabase
      .from("bug_reports")
      .select("*")
      // Explicitly theirs. An admin can read everyone's, and a list headed
      // "what you've reported" full of other people's would be a lie.
      .eq("reported_by", profile.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setMine(data ?? []));
  }, [open, sent, profile]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("bug_reports").insert({
        reported_by: profile?.id ?? null,
        summary: summary.trim(),
        detail: detail.trim() || null,
        page,
        context: collectContext(online),
      });
      if (error) throw new Error(error.message);
      setSent(true);
      setSummary("");
      setDetail("");
      toast.success("Thanks — that's been logged.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that report.");
    } finally {
      setSubmitting(false);
    }
  }

  const dirty = summary.trim().length > 0 || detail.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onInteractOutside={(e) => {
          if (dirty) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="size-4" />
            Report a bug
          </DialogTitle>
          <DialogDescription>
            Something not working, or working oddly. It goes to the group&apos;s
            administrators.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Check className="mt-0.5 size-4 shrink-0" />
              Logged. An admin can see it, along with the page you were on and what
              browser you&apos;re using.
            </p>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setSent(false)}>
                Report another
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bug-summary">What went wrong</Label>
              <Input
                id="bug-summary"
                required
                maxLength={200}
                placeholder="The scanner opens the keyboard over the camera"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bug-detail">What you were doing (optional)</Label>
              <Textarea
                id="bug-detail"
                rows={4}
                placeholder="I tapped Scan a sticker from the Loft, and…"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                What you expected to happen and what happened instead is the most useful
                thing you can write here.
              </p>
            </div>

            {/* Said out loud rather than collected quietly. It is their
                device and their report; they should know what rides along
                with it. */}
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Sent with this report: the page you were on ({page || "—"}), your browser
              and screen size, and whether you were online. Not your location, and
              nothing else you have typed elsewhere in the app.
            </p>

            {!online && (
              <p className="text-xs text-muted-foreground">
                You&apos;re offline, so this can&apos;t be sent yet. It will need
                resending once you have signal.
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !summary.trim() || !online}>
                {submitting ? "Sending…" : "Send report"}
              </Button>
            </DialogFooter>

            {mine.length > 0 && (
              <section className="flex flex-col gap-2 border-t pt-4">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What you&apos;ve reported before
                </h3>
                <ul className="flex flex-col gap-2">
                  {mine.map((report) => (
                    <li key={report.id} className="text-sm">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 break-words">{report.summary}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {report.status}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {format(parseISO(report.created_at), "d MMM yyyy")}
                        {report.resolution && ` — ${report.resolution}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
