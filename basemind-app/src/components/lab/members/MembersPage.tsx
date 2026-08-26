import { useMemo, useState, type FormEvent } from "react";
import {
  HeartPulse,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { labDb } from "@/lib/lab/client";
import { useLabTable, useIndexBy } from "@/lib/lab/useLabTable";
import type { Member, Patrol } from "@/types/lab";
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
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState, MemberAvatar, PatrolChip } from "@/components/lab/LabUi";
import { GROUP_TABS } from "@/components/layout/SectionTabs";

/**
 * The roster.
 *
 * Two things make this different from every other list in BaseMind, and
 * both are about who is in it. These are children, not accounts: they have
 * no login, so nothing here is self-service and every field was typed in by
 * a leader. And the medical, allergy and dietary columns are the reason
 * anybody opens this page in a hurry — so they are surfaced as flags on the
 * list rather than buried one click down in an edit form.
 */

const RANKS = ["Patrol Leader", "Second", "Member"];
const SWIM = ["Confident", "Average", "Weak", "Non-swimmer"];

const emptyForm = {
  first_name: "",
  last_name: "",
  patrol_id: "",
  date_of_birth: "",
  joined_on: "",
  rank: "",
  parent_name: "",
  parent_phone: "",
  parent_email: "",
  medical_notes: "",
  dietary_notes: "",
  allergies: "",
  swim_ability: "",
  notes: "",
  photo_consent: false,
  active: true,
};

type Form = typeof emptyForm;

function toForm(member: Member): Form {
  return {
    first_name: member.first_name,
    last_name: member.last_name,
    patrol_id: member.patrol_id ?? "",
    date_of_birth: member.date_of_birth ?? "",
    joined_on: member.joined_on ?? "",
    rank: member.rank ?? "",
    parent_name: member.parent_name ?? "",
    parent_phone: member.parent_phone ?? "",
    parent_email: member.parent_email ?? "",
    medical_notes: member.medical_notes ?? "",
    dietary_notes: member.dietary_notes ?? "",
    allergies: member.allergies ?? "",
    swim_ability: member.swim_ability ?? "",
    notes: member.notes ?? "",
    photo_consent: member.photo_consent,
    active: member.active,
  };
}

/** Age in whole years, or null when there is no date of birth on file. */
export function ageOf(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export function MembersPage() {
  const { hasRole } = useAuth();
  const { rows: members, loading } = useLabTable("members", { orderBy: "last_name" });
  const { rows: patrols } = useLabTable("patrols", { orderBy: "sort_order" });

  const [search, setSearch] = useState("");
  const [patrolFilter, setPatrolFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [openMember, setOpenMember] = useState<Member | null>(null);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  const patrolsById = useIndexBy(patrols, "id");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (!showInactive && !m.active) return false;
      if (patrolFilter === "none" && m.patrol_id) return false;
      if (patrolFilter !== "all" && patrolFilter !== "none" && m.patrol_id !== patrolFilter) {
        return false;
      }
      if (!term) return true;
      return [m.first_name, m.last_name, m.parent_name, m.rank, m.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [members, search, patrolFilter, showInactive]);

  // Grouped by patrol, in patrol order, with the unallocated at the end —
  // where they are conspicuous, because somebody needs to deal with them.
  const grouped = useMemo(() => {
    const groups = new Map<string, { patrol: Patrol | null; members: Member[] }>();
    for (const patrol of patrols) groups.set(patrol.id, { patrol, members: [] });
    groups.set("none", { patrol: null, members: [] });
    for (const member of filtered) {
      const key = member.patrol_id && groups.has(member.patrol_id) ? member.patrol_id : "none";
      groups.get(key)!.members.push(member);
    }
    return [...groups.values()].filter((g) => g.members.length > 0);
  }, [filtered, patrols]);

  const flaggedCount = members.filter(
    (m) => m.active && (m.medical_notes || m.allergies),
  ).length;

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(member: Member) {
    setEditing(member);
    setForm(toForm(member));
    setDialogOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("A first and last name are needed");
      return;
    }
    setSubmitting(true);

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      patrol_id: form.patrol_id || null,
      date_of_birth: form.date_of_birth || null,
      joined_on: form.joined_on || null,
      rank: form.rank || null,
      parent_name: form.parent_name.trim() || null,
      parent_phone: form.parent_phone.trim() || null,
      parent_email: form.parent_email.trim() || null,
      medical_notes: form.medical_notes.trim() || null,
      dietary_notes: form.dietary_notes.trim() || null,
      allergies: form.allergies.trim() || null,
      swim_ability: form.swim_ability || null,
      notes: form.notes.trim() || null,
      photo_consent: form.photo_consent,
      active: form.active,
    };

    const { error } = editing
      ? await labDb.from("members").update(payload).eq("id", editing.id)
      : await labDb.from("members").insert(payload);

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      editing ? `${payload.first_name} updated` : `${payload.first_name} added to the roster`,
    );
    setDialogOpen(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await labDb.from("members").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${deleteTarget.first_name} removed`);
      if (openMember?.id === deleteTarget.id) setOpenMember(null);
    }
    setDeleteTarget(null);
  }

  return (
    <LabPage
      title="Members"
      description="The young people in the group. They have no logins — everything here is entered by leaders."
      feature="members"
      tabs={GROUP_TABS}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {canEdit && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-4" />
              Add member
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search names, parents, notes…"
            className="pl-8"
          />
        </div>
        <Select value={patrolFilter} onValueChange={setPatrolFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every patrol</SelectItem>
            {patrols.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
            <SelectItem value="none">No patrol</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
          <Checkbox
            checked={showInactive}
            onCheckedChange={(v) => setShowInactive(v === true)}
          />
          Show left
        </label>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground print:hidden">
        <span>
          <strong className="text-foreground">{filtered.length}</strong> shown
        </span>
        <span>·</span>
        <span>
          <strong className="text-foreground">{members.filter((m) => m.active).length}</strong>{" "}
          active
        </span>
        {flaggedCount > 0 && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <HeartPulse className="size-3.5" />
              {flaggedCount} with medical or allergy notes
            </span>
          </>
        )}
      </div>

      {loading && members.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title={members.length === 0 ? "Nobody on the roster yet" : "Nothing matches that"}
          description={
            members.length === 0
              ? "Add the young people in your section, or run the seed file for a demonstration roster."
              : "Try a different search or patrol."
          }
          action={
            canEdit && members.length === 0 ? (
              <Button size="sm" onClick={openAdd}>
                <Plus className="size-4" />
                Add the first member
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ patrol, members: list }) => (
            <section key={patrol?.id ?? "none"} className="space-y-2">
              <div className="flex items-center gap-2">
                <PatrolChip patrol={patrol} />
                <span className="text-xs text-muted-foreground">
                  {list.length} {list.length === 1 ? "member" : "members"}
                </span>
                {patrol?.motto && (
                  <span className="hidden truncate text-xs italic text-muted-foreground sm:inline">
                    “{patrol.motto}”
                  </span>
                )}
              </div>

              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((member) => {
                  const age = ageOf(member.date_of_birth);
                  return (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => setOpenMember(member)}
                        className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                      >
                        <MemberAvatar member={member} patrol={patrol} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {member.first_name} {member.last_name}
                            </span>
                            {!member.active && (
                              <span className="shrink-0 text-xs text-muted-foreground">(left)</span>
                            )}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            {member.rank && <span>{member.rank}</span>}
                            {age !== null && <span>{age}</span>}
                            {member.allergies && (
                              <span className="inline-flex items-center gap-1 font-medium text-destructive">
                                <TriangleAlert className="size-3" />
                                Allergy
                              </span>
                            )}
                            {member.medical_notes && (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                                <HeartPulse className="size-3" />
                                Medical
                              </span>
                            )}
                            {member.dietary_notes && <span>{member.dietary_notes}</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* --- Detail ---------------------------------------------------- */}
      <Dialog open={!!openMember} onOpenChange={(open) => !open && setOpenMember(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {openMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <MemberAvatar
                    member={openMember}
                    patrol={
                      openMember.patrol_id ? patrolsById.get(openMember.patrol_id) ?? null : null
                    }
                  />
                  <span>
                    {openMember.first_name} {openMember.last_name}
                  </span>
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <PatrolChip
                    patrol={
                      openMember.patrol_id ? patrolsById.get(openMember.patrol_id) ?? null : null
                    }
                  />
                  {openMember.rank && <span>{openMember.rank}</span>}
                  {ageOf(openMember.date_of_birth) !== null && (
                    <span>{ageOf(openMember.date_of_birth)} years old</span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {(openMember.allergies || openMember.medical_notes) && (
                  <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                    {openMember.allergies && (
                      <div>
                        <p className="flex items-center gap-1.5 font-medium text-destructive">
                          <TriangleAlert className="size-4" />
                          Allergies
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap">{openMember.allergies}</p>
                      </div>
                    )}
                    {openMember.medical_notes && (
                      <div>
                        <p className="flex items-center gap-1.5 font-medium">
                          <HeartPulse className="size-4" />
                          Medical
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap">{openMember.medical_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
                  <Detail label="Parent">{openMember.parent_name}</Detail>
                  <Detail label="Phone">
                    {openMember.parent_phone ? (
                      <a className="text-primary underline" href={`tel:${openMember.parent_phone}`}>
                        {openMember.parent_phone}
                      </a>
                    ) : null}
                  </Detail>
                  <Detail label="Email">
                    {openMember.parent_email ? (
                      <a
                        className="break-all text-primary underline"
                        href={`mailto:${openMember.parent_email}`}
                      >
                        {openMember.parent_email}
                      </a>
                    ) : null}
                  </Detail>
                  <Detail label="Diet">{openMember.dietary_notes}</Detail>
                  <Detail label="Swimming">{openMember.swim_ability}</Detail>
                  <Detail label="Joined">{openMember.joined_on}</Detail>
                  <Detail label="Photos">
                    {openMember.photo_consent ? "Consent given" : "No consent — do not publish"}
                  </Detail>
                  <Detail label="Notes">{openMember.notes}</Detail>
                </dl>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(openMember)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                ) : (
                  <span />
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const member = openMember;
                      setOpenMember(null);
                      openEdit(member);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Add / edit ------------------------------------------------ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit member" : "Add member"}</DialogTitle>
              <DialogDescription>
                Only a name is required. Everything else can be filled in later — but the medical
                and allergy boxes are the ones worth doing before a camp.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 py-4 sm:grid-cols-2">
              <Field label="First name" required>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Last name" required>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Patrol">
                <Select
                  value={form.patrol_id || "none"}
                  onValueChange={(v) => setForm({ ...form, patrol_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No patrol</SelectItem>
                    {patrols.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Role in the patrol">
                <Select
                  value={form.rank || "none"}
                  onValueChange={(v) => setForm({ ...form, rank: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {RANKS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date of birth">
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                />
              </Field>
              <Field label="Joined">
                <Input
                  type="date"
                  value={form.joined_on}
                  onChange={(e) => setForm({ ...form, joined_on: e.target.value })}
                />
              </Field>

              <Field label="Parent or carer">
                <Input
                  value={form.parent_name}
                  onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                />
              </Field>
              <Field label="Contact phone">
                <Input
                  value={form.parent_phone}
                  onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                />
              </Field>
              <Field label="Contact email" className="sm:col-span-2">
                <Input
                  type="email"
                  value={form.parent_email}
                  onChange={(e) => setForm({ ...form, parent_email: e.target.value })}
                />
              </Field>

              <Field label="Allergies" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                  placeholder="What they react to, and where the medication is kept"
                />
              </Field>
              <Field label="Medical notes" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  value={form.medical_notes}
                  onChange={(e) => setForm({ ...form, medical_notes: e.target.value })}
                  placeholder="Anything a leader needs to know before a camp. Write it as a sentence somebody will actually read."
                />
              </Field>
              <Field label="Dietary">
                <Input
                  value={form.dietary_notes}
                  onChange={(e) => setForm({ ...form, dietary_notes: e.target.value })}
                  placeholder="Vegetarian, halal, coeliac…"
                />
              </Field>
              <Field label="Swimming">
                <Select
                  value={form.swim_ability || "none"}
                  onValueChange={(v) => setForm({ ...form, swim_ability: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not recorded" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not recorded</SelectItem>
                    {SWIM.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Other notes" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.photo_consent}
                  onCheckedChange={(v) => setForm({ ...form, photo_consent: v === true })}
                />
                Photo consent given
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v === true })}
                />
                Still in the section
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editing ? "Save changes" : "Add member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {deleteTarget?.first_name} {deleteTarget?.last_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes their attendance, badges and sign-offs as well. If they have simply
              left the section, untick “Still in the section” instead — that keeps the record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LabPage>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-sm">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="col-span-2 whitespace-pre-wrap">{children}</dd>
    </>
  );
}
