import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { ClipboardCheck, Plus, Printer, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import { INCIDENT_KINDS, type RiskAssessment } from "@/types/lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState, RiskScore } from "@/components/lab/LabUi";
import { CAMP_TABS } from "@/components/layout/SectionTabs";

/**
 * Risk assessments, and the incident log they get rewritten from.
 *
 * The two live on one page because they are the same conversation a week
 * apart: the near miss you log on Sunday is the control you add on
 * Monday. Splitting them across two links is how the log ends up
 * write-only.
 *
 * The score is likelihood times severity, both 1-5, and the colour band is
 * computed rather than chosen — the point of the number is that it is not
 * a matter of opinion once the two inputs are agreed.
 */

export function RiskPage() {
  const { hasRole, profile } = useAuth();
  const [view, setView] = useState<"assessments" | "incidents">("assessments");

  const { rows: events } = useRealtimeTable("events", { orderBy: "start_date", ascending: false });
  const { rows: assessments, loading } = useLabTable("risk_assessments", {
    orderBy: "assessed_on",
    ascending: false,
  });
  const { rows: lines } = useLabTable("risk_lines", { orderBy: "sort_order" });
  const { rows: incidents } = useLabTable("incidents", {
    orderBy: "happened_at",
    ascending: false,
  });

  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [openAssessment, setOpenAssessment] = useState<RiskAssessment | null>(null);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const linesFor = (assessmentId: string) =>
    lines.filter((l) => l.assessment_id === assessmentId);

  return (
    <LabPage
      title="Risk"
      description="Assessments before, and the log of what actually happened after."
      feature="risk"
      tabs={CAMP_TABS}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {canEdit && (
            <Button
              size="sm"
              onClick={() =>
                view === "assessments" ? setAssessmentOpen(true) : setIncidentOpen(true)
              }
            >
              <Plus className="size-4" />
              {view === "assessments" ? "Assessment" : "Log an incident"}
            </Button>
          )}
        </>
      }
    >
      <div className="flex gap-1 rounded-md border p-0.5 print:hidden sm:w-fit">
        {(["assessments", "incidents"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setView(option)}
            className={`flex-1 rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors sm:flex-none ${
              view === option
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {option}
            <span className="ml-1.5 text-xs tabular-nums opacity-70">
              {option === "assessments" ? assessments.length : incidents.length}
            </span>
          </button>
        ))}
      </div>

      {view === "assessments" ? (
        loading && assessments.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : assessments.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="size-6" />}
            title="No assessments yet"
            description="Write one per camp, or one per activity that keeps coming back. Hazards go in one per line and get scored as you add them."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setAssessmentOpen(true)}>
                  <Plus className="size-4" />
                  Write one
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {assessments.map((assessment) => {
              const rows = linesFor(assessment.id);
              const worst = Math.max(0, ...rows.map((r) => r.likelihood * r.severity));
              const event = assessment.event_id ? eventsById.get(assessment.event_id) : null;

              return (
                <li key={assessment.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-medium">{assessment.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(assessment.assessed_on), "d MMM yyyy")}
                        {assessment.assessor && ` · ${assessment.assessor}`}
                        {event && ` · ${event.name}`}
                        {` · ${rows.length} ${rows.length === 1 ? "hazard" : "hazards"}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {worst > 0 && (
                        <RiskScore
                          likelihood={rows.find((r) => r.likelihood * r.severity === worst)!.likelihood}
                          severity={rows.find((r) => r.likelihood * r.severity === worst)!.severity}
                        />
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 print:hidden"
                          onClick={() => setOpenAssessment(assessment)}
                        >
                          Hazards
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground print:hidden"
                          aria-label="Delete assessment"
                          onClick={async () => {
                            const { error } = await labDb
                              .from("risk_assessments")
                              .delete()
                              .eq("id", assessment.id);
                            if (error) toast.error(error.message);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {rows.length > 0 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[36rem] text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="py-1 pr-3 font-medium">Hazard</th>
                            <th className="py-1 pr-3 font-medium">Who</th>
                            <th className="py-1 pr-3 font-medium">Score</th>
                            <th className="py-1 font-medium">Controls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((line) => (
                            <tr key={line.id} className="border-t align-top">
                              <td className="py-2 pr-3">{line.hazard}</td>
                              <td className="py-2 pr-3 text-muted-foreground">
                                {line.who_at_risk}
                              </td>
                              <td className="py-2 pr-3">
                                <RiskScore
                                  likelihood={line.likelihood}
                                  severity={line.severity}
                                />
                              </td>
                              <td className="py-2">{line.controls}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="size-6" />}
          title="Nothing logged"
          description="Log near misses as well as injuries. The near miss is the one that tells you something before it costs anything."
          action={
            canEdit ? (
              <Button size="sm" onClick={() => setIncidentOpen(true)}>
                <Plus className="size-4" />
                Log an incident
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {incidents.map((incident) => {
            const event = incident.event_id ? eventsById.get(incident.event_id) : null;
            return (
              <li key={incident.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          incident.kind === "Injury" || incident.kind === "Safeguarding"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {incident.kind}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(incident.happened_at), "d MMM yyyy, HH:mm")}
                        {event && ` · ${event.name}`}
                      </span>
                    </p>
                    {incident.who_involved && (
                      <p className="mt-1 text-sm font-medium">{incident.who_involved}</p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap text-sm">{incident.what_happened}</p>
                    {incident.action_taken && (
                      <p className="mt-2 whitespace-pre-wrap border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
                        {incident.action_taken}
                      </p>
                    )}
                    <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {incident.first_aid_given && <span>First aid given</span>}
                      {incident.parents_informed && <span>Parents informed</span>}
                      {incident.reportable && (
                        <span className="font-medium text-destructive">Reportable</span>
                      )}
                    </p>
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground print:hidden"
                      aria-label="Delete entry"
                      onClick={async () => {
                        const { error } = await labDb
                          .from("incidents")
                          .delete()
                          .eq("id", incident.id);
                        if (error) toast.error(error.message);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AssessmentDialog
        open={assessmentOpen}
        onOpenChange={setAssessmentOpen}
        events={events}
        approverId={profile?.id ?? null}
      />
      <IncidentDialog
        open={incidentOpen}
        onOpenChange={setIncidentOpen}
        events={events}
        reporterId={profile?.id ?? null}
      />
      <HazardDialog
        assessment={openAssessment}
        onClose={() => setOpenAssessment(null)}
        lines={openAssessment ? linesFor(openAssessment.id) : []}
        canDelete={canDelete}
      />
    </LabPage>
  );
}

function AssessmentDialog({
  open,
  onOpenChange,
  events,
  approverId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: { id: string; name: string }[];
  approverId: string | null;
}) {
  const [title, setTitle] = useState("");
  const [assessor, setAssessor] = useState("");
  const [eventId, setEventId] = useState("");
  const [assessedOn, setAssessedOn] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setAssessor("");
    setEventId("");
    setAssessedOn(new Date().toISOString().slice(0, 10));
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const { error } = await labDb.from("risk_assessments").insert({
      title: title.trim(),
      assessor: assessor.trim() || null,
      event_id: eventId || null,
      activity_id: null,
      assessed_on: assessedOn,
      // A year is the usual review cycle, and a date somebody can change
      // beats a blank field nobody fills in.
      review_on: new Date(new Date(assessedOn).getTime() + 365 * 86400000)
        .toISOString()
        .slice(0, 10),
      approved_by: approverId,
      notes: null,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assessment created — now add the hazards");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New risk assessment</DialogTitle>
            <DialogDescription>
              Create it here, then add hazards to it one at a time — each with a likelihood, a
              severity and what you are doing about it.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekend camp — general"
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Who wrote it</Label>
              <Input value={assessor} onChange={(e) => setAssessor(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Camp</Label>
              <Select
                value={eventId || "none"}
                onValueChange={(v) => setEventId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not tied to a camp</SelectItem>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Assessed on</Label>
              <Input
                type="date"
                value={assessedOn}
                onChange={(e) => setAssessedOn(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HazardDialog({
  assessment,
  onClose,
  lines,
  canDelete,
}: {
  assessment: RiskAssessment | null;
  onClose: () => void;
  lines: {
    id: string;
    hazard: string;
    who_at_risk: string | null;
    likelihood: number;
    severity: number;
    controls: string | null;
  }[];
  canDelete: boolean;
}) {
  const [hazard, setHazard] = useState("");
  const [who, setWho] = useState("Everyone");
  const [likelihood, setLikelihood] = useState("2");
  const [severity, setSeverity] = useState("3");
  const [controls, setControls] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!assessment || !hazard.trim()) return;
    setSaving(true);

    const { error } = await labDb.from("risk_lines").insert({
      assessment_id: assessment.id,
      hazard: hazard.trim(),
      who_at_risk: who.trim() || null,
      likelihood: Number(likelihood),
      severity: Number(severity),
      controls: controls.trim() || null,
      residual_note: null,
      sort_order: lines.length + 1,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHazard("");
    setControls("");
  }

  return (
    <Dialog open={!!assessment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{assessment?.title}</DialogTitle>
          <DialogDescription>
            Likelihood and severity are both 1 to 5. The band is worked out from the two, so
            nobody has to argue about whether something is &ldquo;amber&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {lines.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {lines.map((line) => (
              <li key={line.id} className="flex items-start gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{line.hazard}</p>
                  {line.controls && (
                    <p className="mt-0.5 text-muted-foreground">{line.controls}</p>
                  )}
                </div>
                <RiskScore likelihood={line.likelihood} severity={line.severity} />
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    aria-label="Remove hazard"
                    onClick={async () => {
                      const { error } = await labDb
                        .from("risk_lines")
                        .delete()
                        .eq("id", line.id);
                      if (error) toast.error(error.message);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="grid gap-3 border-t pt-4">
          <div>
            <Label className="mb-1.5 block">Hazard</Label>
            <Input
              value={hazard}
              onChange={(e) => setHazard(e.target.value)}
              placeholder="Cooking on open fires"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1.5 block">Who is at risk</Label>
              <Input value={who} onChange={(e) => setWho(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Likelihood</Label>
              <Select value={likelihood} onValueChange={setLikelihood}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">What you are doing about it</Label>
            <Textarea
              rows={3}
              value={controls}
              onChange={(e) => setControls(e.target.value)}
              placeholder="Fire area marked and fenced. Buckets of water at each fire. Leader present whenever one is lit."
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Score: <RiskScore likelihood={Number(likelihood)} severity={Number(severity)} />
            </span>
            <Button type="submit" disabled={saving || !hazard.trim()}>
              <Plus className="size-4" />
              Add hazard
            </Button>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IncidentDialog({
  open,
  onOpenChange,
  events,
  reporterId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: { id: string; name: string }[];
  reporterId: string | null;
}) {
  const [kind, setKind] = useState<string>("Near miss");
  const [eventId, setEventId] = useState("");
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [action, setAction] = useState("");
  const [firstAid, setFirstAid] = useState(false);
  const [parents, setParents] = useState(false);
  const [reportable, setReportable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind("Near miss");
    setWho("");
    setWhat("");
    setAction("");
    setFirstAid(false);
    setParents(false);
    setReportable(false);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!what.trim()) return;
    setSaving(true);

    const { error } = await labDb.from("incidents").insert({
      event_id: eventId || null,
      happened_at: new Date().toISOString(),
      kind,
      who_involved: who.trim() || null,
      what_happened: what.trim(),
      action_taken: action.trim() || null,
      first_aid_given: firstAid,
      parents_informed: parents,
      reportable,
      reported_by: reporterId,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Logged");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Log an incident</DialogTitle>
            <DialogDescription>
              Write it down while it is fresh, including the ones where nothing happened. This is
              a record for the group, not a report to anybody — sending it on is a separate,
              deliberate act.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Kind</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Camp</Label>
                <Select
                  value={eventId || "none"}
                  onValueChange={(v) => setEventId(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not at a camp</SelectItem>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Who was involved</Label>
              <Input
                value={who}
                onChange={(e) => setWho(e.target.value)}
                placeholder="One member, two leaders…"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">What happened</Label>
              <Textarea rows={4} value={what} onChange={(e) => setWhat(e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5 block">What was done about it</Label>
              <Textarea rows={3} value={action} onChange={(e) => setAction(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={firstAid} onCheckedChange={(v) => setFirstAid(v === true)} />
              First aid given
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={parents} onCheckedChange={(v) => setParents(v === true)} />
              Parents informed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={reportable} onCheckedChange={(v) => setReportable(v === true)} />
              Needs reporting on
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Log it"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
