import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Award, Minus, Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { labDb } from "@/lib/lab/client";
import { useLabTable, useIndexBy } from "@/lib/lab/useLabTable";
import type { Patrol, PatrolStanding } from "@/types/lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { EmptyState, PatrolChip, hueStyle } from "@/components/lab/LabUi";
import { GROUP_TABS } from "@/components/layout/SectionTabs";
import { COLOURS } from "@/lib/userIcon";

/**
 * The patrol competition.
 *
 * Points are a ledger — see the migration — so the standings come from a
 * database function rather than a column anybody could nudge. The two
 * halves of this page are deliberately both visible at once: the table
 * answers "who is winning", the ledger underneath answers "why", and the
 * second question follows the first within about four seconds of a patrol
 * seeing the first.
 */

/** The quick-award buttons. Most awards are one of these. */
const QUICK_REASONS = [
  { points: 10, reason: "Inspection" },
  { points: 20, reason: "Won the activity" },
  { points: 5, reason: "Helped without being asked" },
  { points: -5, reason: "Kit left out" },
];

export function PointsPage() {
  const { hasRole } = useAuth();
  const { rows: patrols } = useLabTable("patrols", { orderBy: "sort_order" });
  const { rows: awards } = useLabTable("point_awards", {
    orderBy: "awarded_at",
    ascending: false,
  });
  const { rows: members } = useLabTable("members", { orderBy: "first_name" });

  const [standings, setStandings] = useState<PatrolStanding[]>([]);
  const [awardOpen, setAwardOpen] = useState(false);
  const [patrolOpen, setPatrolOpen] = useState(false);
  const [editingPatrol, setEditingPatrol] = useState<Patrol | null>(null);

  const canAward = hasRole(["Admin", "Manager", "Member"]);
  const canManage = hasRole(["Admin", "Manager"]);

  const patrolsById = useIndexBy(patrols, "id");
  const membersById = useIndexBy(members, "id");

  /**
   * The standings are re-fetched whenever the ledger changes rather than
   * summed in the browser. Both would work today; only one of them still
   * matches after somebody adds a rule about points expiring.
   */
  const refreshStandings = useCallback(async () => {
    const { data, error } = await labDb.rpc("patrol_standings");
    if (!error && data) setStandings(data as PatrolStanding[]);
  }, []);

  useEffect(() => {
    void refreshStandings();
  }, [refreshStandings, awards.length, patrols.length]);

  const leader = standings[0];
  const maxPoints = Math.max(1, ...standings.map((s) => s.points));

  return (
    <LabPage
      title="Patrol points"
      description="The running competition. Every award says who gave it and what for."
      feature="points"
      tabs={GROUP_TABS}
      actions={
        <>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingPatrol(null);
                setPatrolOpen(true);
              }}
            >
              <Plus className="size-4" />
              Patrol
            </Button>
          )}
          {canAward && patrols.length > 0 && (
            <Button size="sm" onClick={() => setAwardOpen(true)}>
              <Award className="size-4" />
              Award points
            </Button>
          )}
        </>
      }
    >
      {patrols.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-6" />}
          title="No patrols yet"
          description="Add a patrol or two and the competition table appears here."
          action={
            canManage ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditingPatrol(null);
                  setPatrolOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add a patrol
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="space-y-2">
            {leader && leader.points > 0 && (
              <p className="text-sm text-muted-foreground">
                <Trophy className="mr-1 inline size-4 text-amber-500" />
                <strong className="text-foreground">{leader.name}</strong> in front with{" "}
                {leader.points} points.
              </p>
            )}

            <ol className="space-y-2">
              {standings.map((standing, index) => (
                <li
                  key={standing.patrol_id}
                  className="rounded-lg border bg-card p-3"
                  style={hueStyle(standing.colour)}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium" style={{ color: "var(--hue)" }}>
                          {standing.name}
                        </span>
                        <span className="shrink-0 text-lg font-semibold tabular-nums">
                          {standing.points}
                        </span>
                      </span>
                      {/* Bar widths are relative to the leader, not to a
                          fixed maximum: a table where every bar is 4% wide
                          tells nobody anything. */}
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${Math.max(2, (standing.points / maxPoints) * 100)}%`,
                            backgroundColor: "var(--hue)",
                          }}
                        />
                      </span>
                      <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>
                          {standing.member_count}{" "}
                          {standing.member_count === 1 ? "member" : "members"}
                        </span>
                        {standing.last_awarded_at && (
                          <span>
                            last{" "}
                            {formatDistanceToNow(parseISO(standing.last_awarded_at), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </span>
                    </span>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          const patrol = patrolsById.get(standing.patrol_id);
                          if (patrol) {
                            setEditingPatrol(patrol);
                            setPatrolOpen(true);
                          }
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Recent awards
            </h2>
            {awards.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nothing awarded yet.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {awards.slice(0, 40).map((award) => {
                  const patrol = patrolsById.get(award.patrol_id);
                  const member = award.member_id ? membersById.get(award.member_id) : null;
                  return (
                    <li key={award.id} className="flex items-start gap-3 p-3 text-sm">
                      <span
                        className={`w-10 shrink-0 text-right font-semibold tabular-nums ${
                          award.points < 0 ? "text-destructive" : "text-primary"
                        }`}
                      >
                        {award.points > 0 ? "+" : ""}
                        {award.points}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <PatrolChip patrol={patrol} />
                          {member && (
                            <span className="text-xs text-muted-foreground">
                              {member.first_name} {member.last_name}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block break-words">{award.reason}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(parseISO(award.awarded_at), { addSuffix: true })}
                        </span>
                      </span>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground"
                          aria-label="Delete award"
                          onClick={async () => {
                            const { error } = await labDb
                              .from("point_awards")
                              .delete()
                              .eq("id", award.id);
                            if (error) toast.error(error.message);
                            else void refreshStandings();
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      <AwardDialog
        open={awardOpen}
        onOpenChange={setAwardOpen}
        patrols={patrols}
        members={members}
        onSaved={refreshStandings}
      />
      <PatrolDialog
        open={patrolOpen}
        onOpenChange={setPatrolOpen}
        patrol={editingPatrol}
        nextSort={patrols.length + 1}
        onSaved={refreshStandings}
      />
    </LabPage>
  );
}

function AwardDialog({
  open,
  onOpenChange,
  patrols,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patrols: Patrol[];
  members: { id: string; first_name: string; last_name: string; patrol_id: string | null }[];
  onSaved: () => void;
}) {
  const { profile } = useAuth();
  const [patrolId, setPatrolId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [points, setPoints] = useState("10");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPatrolId(patrols[0]?.id ?? "");
      setMemberId("");
      setPoints("10");
      setReason("");
    }
  }, [open, patrols]);

  // Naming a member should not mean also remembering which patrol they are
  // in — the points go to the patrol either way.
  const eligibleMembers = useMemo(
    () => members.filter((m) => !patrolId || m.patrol_id === patrolId),
    [members, patrolId],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!patrolId) return;
    const value = Number.parseInt(points, 10);
    if (!Number.isFinite(value) || value === 0) {
      toast.error("Points must be a number, and not zero");
      return;
    }
    if (!reason.trim()) {
      toast.error("Say what the points are for — that is the whole point of the ledger");
      return;
    }

    setSaving(true);
    const { error } = await labDb.from("point_awards").insert({
      patrol_id: patrolId,
      member_id: memberId || null,
      points: value,
      reason: reason.trim(),
      awarded_by: profile?.id ?? null,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${value > 0 ? "+" : ""}${value} to ${patrols.find((p) => p.id === patrolId)?.name}`);
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Award points</DialogTitle>
            <DialogDescription>
              Negative numbers are allowed, and they show up in the ledger the same way — which
              is fairer than quietly editing a total.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Patrol</Label>
              <Select value={patrolId} onValueChange={setPatrolId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a patrol" />
                </SelectTrigger>
                <SelectContent>
                  {patrols.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">For someone in particular (optional)</Label>
              <Select
                value={memberId || "none"}
                onValueChange={(v) => setMemberId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">The whole patrol</SelectItem>
                  {eligibleMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {QUICK_REASONS.map((quick) => (
                <Button
                  key={quick.reason}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPoints(String(quick.points));
                    setReason(quick.reason);
                  }}
                >
                  {quick.points > 0 ? (
                    <Plus className="size-3.5" />
                  ) : (
                    <Minus className="size-3.5" />
                  )}
                  {quick.reason}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <div>
                <Label className="mb-1.5 block">Points</Label>
                <Input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">What for</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Best tent line at inspection"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !patrolId}>
              {saving ? "Saving…" : "Award"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PatrolDialog({
  open,
  onOpenChange,
  patrol,
  nextSort,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patrol: Patrol | null;
  nextSort: number;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [colour, setColour] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(patrol?.name ?? "");
    setMotto(patrol?.motto ?? "");
    setColour(patrol?.colour ?? 1);
  }, [open, patrol]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const payload = {
      name: name.trim(),
      motto: motto.trim() || null,
      colour,
    };

    const { error } = patrol
      ? await labDb.from("patrols").update(payload).eq("id", patrol.id)
      : await labDb.from("patrols").insert({
          ...payload,
          emblem: null,
          sort_order: nextSort,
          active: true,
        });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(patrol ? "Patrol updated" : `${payload.name} added`);
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{patrol ? "Edit patrol" : "New patrol"}</DialogTitle>
            <DialogDescription>
              The colour is one of the eight the app already uses for person badges, so it works
              in dark mode without anybody choosing a hex code at eleven at night.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5 block">Motto</Label>
              <Input
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="Optional, and traditionally daft"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Colour</Label>
              <div className="flex flex-wrap gap-2">
                {COLOURS.map((c) => (
                  <button
                    key={c.index}
                    type="button"
                    onClick={() => setColour(c.index)}
                    aria-label={c.label}
                    aria-pressed={colour === c.index}
                    className={`size-8 rounded-full ring-offset-2 ring-offset-background transition-[box-shadow] ${
                      colour === c.index ? "ring-2 ring-ring" : "ring-1 ring-border"
                    }`}
                    style={{ backgroundColor: `var(--avatar-${c.index})` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : patrol ? "Save" : "Add patrol"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
