import { useMemo, useState, type FormEvent } from "react";
import { Award, BadgeCheck, ChevronRight, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { labDb } from "@/lib/lab/client";
import { useLabTable, useIndexBy } from "@/lib/lab/useLabTable";
import type { LabBadge, Member } from "@/types/lab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState, MemberAvatar, PatrolChip, hueStyle } from "@/components/lab/LabUi";
import { GROUP_TABS } from "@/components/layout/SectionTabs";
import { COLOURS } from "@/lib/userIcon";

/**
 * Badges, and the year of work in between them.
 *
 * The schema stores requirement sign-offs separately from awarded badges,
 * and this page is why: a member three requirements into the Navigator
 * badge has done something, and a screen that can only say "no badge yet"
 * throws that away. Ticking the last requirement offers the badge rather
 * than granting it — awarding is a leader's decision, not a total.
 */

export function ProgressionPage() {
  const { hasRole, profile } = useAuth();
  const { rows: members, loading } = useLabTable("members", { orderBy: "first_name" });
  const { rows: patrols } = useLabTable("patrols", { orderBy: "sort_order" });
  const { rows: badges } = useLabTable("badges", { orderBy: "sort_order" });
  const { rows: requirements } = useLabTable("badge_requirements", { orderBy: "sort_order" });
  const { rows: memberBadges } = useLabTable("member_badges");
  const { rows: memberRequirements } = useLabTable("member_requirements");

  const [search, setSearch] = useState("");
  const [openMember, setOpenMember] = useState<Member | null>(null);
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canManage = hasRole(["Admin", "Manager"]);

  const patrolsById = useIndexBy(patrols, "id");

  const requirementsByBadge = useMemo(() => {
    const map = new Map<string, typeof requirements>();
    for (const req of requirements) {
      const list = map.get(req.badge_id) ?? [];
      list.push(req);
      map.set(req.badge_id, list);
    }
    return map;
  }, [requirements]);

  const badgesByMember = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const mb of memberBadges) {
      const set = map.get(mb.member_id) ?? new Set<string>();
      set.add(mb.badge_id);
      map.set(mb.member_id, set);
    }
    return map;
  }, [memberBadges]);

  const requirementsByMember = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const mr of memberRequirements) {
      const set = map.get(mr.member_id) ?? new Set<string>();
      set.add(mr.requirement_id);
      map.set(mr.member_id, set);
    }
    return map;
  }, [memberRequirements]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members
      .filter((m) => m.active)
      .filter(
        (m) =>
          !term || `${m.first_name} ${m.last_name}`.toLowerCase().includes(term),
      );
  }, [members, search]);

  const totalRequirements = requirements.length;

  async function toggleRequirement(member: Member, requirementId: string, done: boolean) {
    if (done) {
      const { error } = await labDb.from("member_requirements").insert({
        member_id: member.id,
        requirement_id: requirementId,
        done_on: new Date().toISOString().slice(0, 10),
        signed_off_by: profile?.id ?? null,
        note: null,
      });
      if (error) toast.error(error.message);
    } else {
      const { error } = await labDb
        .from("member_requirements")
        .delete()
        .eq("member_id", member.id)
        .eq("requirement_id", requirementId);
      if (error) toast.error(error.message);
    }
  }

  async function toggleBadge(member: Member, badge: LabBadge, awarded: boolean) {
    if (awarded) {
      const { error } = await labDb.from("member_badges").insert({
        member_id: member.id,
        badge_id: badge.id,
        awarded_on: new Date().toISOString().slice(0, 10),
        awarded_by: profile?.id ?? null,
        notes: null,
      });
      if (error) toast.error(error.message);
      else toast.success(`${badge.name} awarded to ${member.first_name}`);
    } else {
      const { error } = await labDb
        .from("member_badges")
        .delete()
        .eq("member_id", member.id)
        .eq("badge_id", badge.id);
      if (error) toast.error(error.message);
    }
  }

  return (
    <LabPage
      title="Progression"
      description="Badges awarded, and the requirements signed off on the way to them."
      feature="progression"
      tabs={GROUP_TABS}
      actions={
        canManage ? (
          <Button variant="outline" size="sm" onClick={() => setBadgeDialogOpen(true)}>
            <Plus className="size-4" />
            Badge
          </Button>
        ) : undefined
      }
    >
      {badges.length === 0 ? (
        <EmptyState
          icon={<Award className="size-6" />}
          title="No badges set up"
          description="Add the badges your section works towards, each with the requirements that make it up."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setBadgeDialogOpen(true)}>
                <Plus className="size-4" />
                Add a badge
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="relative max-w-sm print:hidden">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find someone"
              className="pl-8"
            />
          </div>

          {/* The badge legend doubles as the column key for the dots below. */}
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge.id}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
                style={{
                  ...hueStyle(badge.colour),
                  backgroundColor: "var(--hue-faint)",
                  color: "var(--hue)",
                }}
              >
                {badge.name}
                <span className="opacity-70">
                  {memberBadges.filter((mb) => mb.badge_id === badge.id).length}
                </span>
              </span>
            ))}
          </div>

          {loading && members.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : visible.length === 0 ? (
            <EmptyState title="Nobody matches that" />
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {visible.map((member) => {
                const held = badgesByMember.get(member.id) ?? new Set();
                const done = requirementsByMember.get(member.id) ?? new Set();
                const percent =
                  totalRequirements === 0
                    ? 0
                    : Math.round(
                        ((done.size +
                          // A held badge counts as all of its requirements,
                          // whether or not they were ticked one by one —
                          // most badges get awarded on the night.
                          badges
                            .filter((b) => held.has(b.id))
                            .reduce(
                              (sum, b) =>
                                sum +
                                (requirementsByBadge.get(b.id) ?? []).filter(
                                  (r) => !done.has(r.id),
                                ).length,
                              0,
                            )) /
                          totalRequirements) *
                          100,
                      );

                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => setOpenMember(member)}
                      className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                    >
                      <MemberAvatar
                        member={member}
                        patrol={member.patrol_id ? patrolsById.get(member.patrol_id) : null}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">
                            {member.first_name} {member.last_name}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {held.size}/{badges.length}
                          </span>
                        </span>
                        <span className="mt-1.5 flex gap-1">
                          {badges.map((badge) => (
                            <span
                              key={badge.id}
                              title={badge.name}
                              className="size-2.5 rounded-full ring-1 ring-inset ring-border"
                              style={{
                                backgroundColor: held.has(badge.id)
                                  ? `var(--avatar-${badge.colour})`
                                  : "transparent",
                              }}
                            />
                          ))}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {percent}% of everything on offer
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* --- One member's record --------------------------------------- */}
      <Dialog open={!!openMember} onOpenChange={(open) => !open && setOpenMember(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {openMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <MemberAvatar
                    member={openMember}
                    patrol={openMember.patrol_id ? patrolsById.get(openMember.patrol_id) : null}
                  />
                  {openMember.first_name} {openMember.last_name}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <PatrolChip
                    patrol={openMember.patrol_id ? patrolsById.get(openMember.patrol_id) : null}
                  />
                  {canEdit ? "Tick as they go." : "Read-only — ask a leader to sign things off."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {badges.map((badge) => {
                  const held = (badgesByMember.get(openMember.id) ?? new Set()).has(badge.id);
                  const reqs = requirementsByBadge.get(badge.id) ?? [];
                  const done = requirementsByMember.get(openMember.id) ?? new Set();
                  const doneCount = reqs.filter((r) => done.has(r.id)).length;
                  const complete = reqs.length > 0 && doneCount === reqs.length;

                  return (
                    <section
                      key={badge.id}
                      className="rounded-lg border p-3"
                      style={hueStyle(badge.colour)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium">
                            {held && (
                              <BadgeCheck className="size-4" style={{ color: "var(--hue)" }} />
                            )}
                            {badge.name}
                          </p>
                          {badge.description && (
                            <p className="text-xs text-muted-foreground">{badge.description}</p>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant={held ? "outline" : "default"}
                            className="shrink-0"
                            onClick={() => toggleBadge(openMember, badge, !held)}
                          >
                            {held ? "Withdraw" : "Award"}
                          </Button>
                        )}
                      </div>

                      {reqs.length > 0 && (
                        <>
                          <ul className="mt-2 space-y-1.5">
                            {reqs.map((req) => {
                              const ticked = done.has(req.id);
                              return (
                                <li key={req.id} className="flex items-start gap-2 text-sm">
                                  <Checkbox
                                    className="mt-0.5"
                                    checked={ticked}
                                    disabled={!canEdit}
                                    onCheckedChange={(v) =>
                                      toggleRequirement(openMember, req.id, v === true)
                                    }
                                  />
                                  <span className={ticked ? "text-muted-foreground" : undefined}>
                                    {req.text}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          {complete && !held && (
                            <p className="mt-2 text-xs" style={{ color: "var(--hue)" }}>
                              Everything ticked — this one is ready to award.
                            </p>
                          )}
                          {!complete && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {doneCount} of {reqs.length} done
                            </p>
                          )}
                        </>
                      )}
                    </section>
                  );
                })}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenMember(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <NewBadgeDialog
        open={badgeDialogOpen}
        onOpenChange={setBadgeDialogOpen}
        nextSort={badges.length + 1}
      />
    </LabPage>
  );
}

function NewBadgeDialog({
  open,
  onOpenChange,
  nextSort,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextSort: number;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [colour, setColour] = useState(1);
  const [requirementText, setRequirementText] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const { data, error } = await labDb
      .from("badges")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        colour,
        sort_order: nextSort,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Couldn't save the badge");
      return;
    }

    // One requirement per line: typing them into a textarea is how anybody
    // actually has them to hand, and a row-at-a-time form would be six
    // clicks per badge.
    const lines = requirementText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 0) {
      const { error: reqError } = await labDb.from("badge_requirements").insert(
        lines.map((text, index) => ({
          badge_id: data.id,
          text,
          sort_order: index + 1,
        })),
      );
      if (reqError) toast.error(reqError.message);
    }

    setSaving(false);
    toast.success(`${name.trim()} added`);
    setName("");
    setDescription("");
    setCategory("");
    setRequirementText("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New badge</DialogTitle>
            <DialogDescription>
              Requirements go one per line. They can be edited later, and a badge with none still
              works — it is just awarded rather than worked through.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label className="mb-1.5 block">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Category</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Activity, Staged, Interest…"
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
                    className={`size-8 rounded-full ring-offset-2 ring-offset-background ${
                      colour === c.index ? "ring-2 ring-ring" : "ring-1 ring-border"
                    }`}
                    style={{ backgroundColor: `var(--avatar-${c.index})` }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Requirements, one per line</Label>
              <Textarea
                rows={6}
                value={requirementText}
                onChange={(e) => setRequirementText(e.target.value)}
                placeholder={"Pitch a tent with your patrol\nPack your own kit for a weekend"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add badge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
