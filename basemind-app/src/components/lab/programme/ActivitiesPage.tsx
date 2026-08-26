import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Clock, Heart, Search, Sparkles, Trash2, Plus, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import type { Activity } from "@/types/lab";
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
import { EmptyState } from "@/components/lab/LabUi";
import { GROUP_TABS } from "@/components/layout/SectionTabs";

/**
 * The activity library — what to actually do on a Thursday.
 *
 * Every group has this list already; it is in somebody's head, or in a
 * notebook that leaves when they do. Writing it down with the kit it needs
 * and how long it takes is what makes a programme plannable by whoever is
 * free rather than by whoever remembers.
 *
 * `times_run` is incremented from the programme page, not here, and it is
 * the most useful column on the page: it is the difference between "we
 * could do British Bulldog" and "we have done British Bulldog eleven times
 * this year".
 */

const KINDS = ["Game", "Skill", "Craft", "Cooking", "Outdoor", "Campfire", "Other"];

export function ActivitiesPage() {
  const { hasRole } = useAuth();
  const { rows: activities, loading } = useLabTable("activities", { orderBy: "name" });

  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [placeFilter, setPlaceFilter] = useState("any");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [openActivity, setOpenActivity] = useState<Activity | null>(null);

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (kindFilter !== "all" && a.kind !== kindFilter) return false;
      if (placeFilter === "indoors" && !a.indoors) return false;
      if (placeFilter === "outdoors" && !a.outdoors) return false;
      if (!term) return true;
      return [a.name, a.description, a.kit_needed, a.kind]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [activities, search, kindFilter, placeFilter]);

  async function toggleFavourite(activity: Activity) {
    const { error } = await labDb
      .from("activities")
      .update({ favourite: !activity.favourite })
      .eq("id", activity.id);
    if (error) toast.error(error.message);
  }

  return (
    <LabPage
      title="Activities"
      description="The things you can actually run, with what they need and how long they take."
      feature="programme"
      tabs={GROUP_TABS}
      actions={
        canEdit ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add activity
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search names, kit, descriptions…"
            className="pl-8"
          />
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any kind</SelectItem>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={placeFilter} onValueChange={setPlaceFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Anywhere</SelectItem>
            <SelectItem value="indoors">Works indoors</SelectItem>
            <SelectItem value="outdoors">Works outdoors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && activities.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title={activities.length === 0 ? "The library is empty" : "Nothing matches that"}
          description={
            activities.length === 0
              ? "Write down the games and skills you already run. Future-you, planning a programme on a Wednesday night, will be grateful."
              : undefined
          }
          action={
            canEdit && activities.length === 0 ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add the first
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((activity) => (
            <li key={activity.id} className="flex flex-col rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setOpenActivity(activity)}
                >
                  <p className="font-medium">{activity.name}</p>
                  {activity.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                  )}
                </button>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={
                      activity.favourite ? "Remove from favourites" : "Mark as a favourite"
                    }
                    onClick={() => toggleFavourite(activity)}
                  >
                    <Heart
                      className={`size-4 ${
                        activity.favourite
                          ? "fill-destructive text-destructive"
                          : "text-muted-foreground"
                      }`}
                    />
                  </Button>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {activity.duration_minutes} min
                </span>
                {activity.kind && <span>{activity.kind}</span>}
                <span>
                  {activity.indoors && activity.outdoors
                    ? "In or out"
                    : activity.indoors
                      ? "Indoors"
                      : "Outdoors"}
                </span>
                {activity.risk_notes && (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <TriangleAlert className="size-3" />
                    Risk note
                  </span>
                )}
                {activity.times_run > 0 && <span>run {activity.times_run}×</span>}
              </div>

              {activity.kit_needed && (
                <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">Kit:</strong>{" "}
                  {activity.kit_needed}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!openActivity} onOpenChange={(open) => !open && setOpenActivity(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {openActivity && (
            <>
              <DialogHeader>
                <DialogTitle>{openActivity.name}</DialogTitle>
                <DialogDescription>
                  {openActivity.duration_minutes} minutes
                  {openActivity.kind && ` · ${openActivity.kind}`}
                  {openActivity.min_people != null &&
                    ` · ${openActivity.min_people}+ people`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                {openActivity.description && <p>{openActivity.description}</p>}
                {openActivity.instructions && (
                  <div>
                    <p className="font-medium">How it runs</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {openActivity.instructions}
                    </p>
                  </div>
                )}
                {openActivity.kit_needed && (
                  <div>
                    <p className="font-medium">Kit</p>
                    <p className="text-muted-foreground">{openActivity.kit_needed}</p>
                  </div>
                )}
                {openActivity.risk_notes && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                    <p className="flex items-center gap-1.5 font-medium">
                      <TriangleAlert className="size-4" />
                      Watch out for
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap">{openActivity.risk_notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={async () => {
                      const { error } = await labDb
                        .from("activities")
                        .delete()
                        .eq("id", openActivity.id);
                      if (error) toast.error(error.message);
                      else setOpenActivity(null);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                ) : (
                  <span />
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(openActivity);
                      setOpenActivity(null);
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} activity={editing} />
    </LabPage>
  );
}

function ActivityDialog({
  open,
  onOpenChange,
  activity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    kind: "Game",
    duration: "15",
    indoors: true,
    outdoors: true,
    kit: "",
    instructions: "",
    risk: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: activity?.name ?? "",
      description: activity?.description ?? "",
      kind: activity?.kind ?? "Game",
      duration: String(activity?.duration_minutes ?? 15),
      indoors: activity?.indoors ?? true,
      outdoors: activity?.outdoors ?? true,
      kit: activity?.kit_needed ?? "",
      instructions: activity?.instructions ?? "",
      risk: activity?.risk_notes ?? "",
    });
  }, [open, activity]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      kind: form.kind,
      duration_minutes: Number(form.duration) || 15,
      indoors: form.indoors,
      outdoors: form.outdoors,
      kit_needed: form.kit.trim() || null,
      instructions: form.instructions.trim() || null,
      risk_notes: form.risk.trim() || null,
    };

    const { error } = activity
      ? await labDb.from("activities").update(payload).eq("id", activity.id)
      : await labDb.from("activities").insert({
          ...payload,
          min_people: null,
          max_people: null,
          source: null,
          favourite: false,
          times_run: 0,
        });

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(activity ? "Activity updated" : `${payload.name} added`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{activity ? "Edit activity" : "New activity"}</DialogTitle>
            <DialogDescription>
              The kit line and the risk note are the two that make this worth writing down —
              they are what you would otherwise remember at eight o&apos;clock on the night.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">In one line</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Minutes</Label>
                <Input
                  inputMode="numeric"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.indoors}
                  onCheckedChange={(v) => setForm({ ...form, indoors: v === true })}
                />
                Works indoors
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.outdoors}
                  onCheckedChange={(v) => setForm({ ...form, outdoors: v === true })}
                />
                Works outdoors
              </label>
            </div>
            <div>
              <Label className="mb-1.5 block">Kit needed</Label>
              <Input
                value={form.kit}
                onChange={(e) => setForm({ ...form, kit: e.target.value })}
                placeholder="Two ropes per patrol, a knot card each"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">How it runs</Label>
              <Textarea
                rows={4}
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Watch out for</Label>
              <Textarea
                rows={2}
                value={form.risk}
                onChange={(e) => setForm({ ...form, risk: e.target.value })}
                placeholder="Hard floor and enthusiasm. Ban sliding tackles before, not after."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : activity ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
