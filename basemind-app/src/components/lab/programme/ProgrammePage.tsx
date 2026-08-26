import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { CalendarRange, Clock, Copy, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
 * The plan for a meeting night.
 *
 * Slots carry their own title rather than reading it through the activity
 * link (see the migration): editing "British Bulldog" in the library must
 * not rewrite what last February's programme says happened. The link is
 * kept anyway, so the kit list and the risk note are still one click away
 * while the plan is being written.
 *
 * The running clock down the left is the entire value of the page. A
 * programme that adds up to ninety minutes in a seventy-five minute
 * meeting is the single most common way a Thursday goes wrong, and it is
 * invisible until somebody adds the times up.
 */

/** Meetings start at half past six for most sections. Editable per programme. */
const DEFAULT_START = "18:30";

export function ProgrammePage() {
  const { hasRole } = useAuth();
  const { rows: programmes, loading } = useLabTable("programmes", {
    orderBy: "meets_on",
    ascending: false,
  });
  const { rows: slots } = useLabTable("programme_slots", { orderBy: "sort_order" });
  const { rows: activities } = useLabTable("activities", { orderBy: "name" });

  const [activeId, setActiveId] = useState("");
  const [programmeOpen, setProgrammeOpen] = useState(false);
  const [startTime, setStartTime] = useState(DEFAULT_START);
  const [slotTitle, setSlotTitle] = useState("");
  const [slotMinutes, setSlotMinutes] = useState("15");
  const [slotActivity, setSlotActivity] = useState("");

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const canDelete = hasRole(["Admin", "Manager"]);

  const active = programmes.find((p) => p.id === activeId) ?? programmes[0] ?? null;

  const activeSlots = useMemo(
    () => (active ? slots.filter((s) => s.programme_id === active.id) : []),
    [slots, active],
  );

  const totalMinutes = activeSlots.reduce((sum, slot) => sum + slot.minutes, 0);

  /**
   * Clock times, worked out by running the durations forward from the
   * start. Storing a time per slot would look the same until somebody
   * changed one duration in the middle and every time below it was wrong.
   */
  const timings = useMemo(() => {
    const [hours, minutes] = startTime.split(":").map(Number);
    let cursor = (hours || 0) * 60 + (minutes || 0);
    return activeSlots.map((slot) => {
      const at = cursor;
      cursor += slot.minutes;
      return `${String(Math.floor(at / 60) % 24).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`;
    });
  }, [activeSlots, startTime]);

  async function addSlot(e: FormEvent) {
    e.preventDefault();
    if (!active) return;

    const activity = activities.find((a) => a.id === slotActivity);
    const title = slotTitle.trim() || activity?.name;
    if (!title) {
      toast.error("Give the slot a name, or pick an activity");
      return;
    }

    const { error } = await labDb.from("programme_slots").insert({
      programme_id: active.id,
      title,
      activity_id: activity?.id ?? null,
      minutes: Number(slotMinutes) || activity?.duration_minutes || 15,
      lead_person: null,
      notes: null,
      sort_order: activeSlots.length + 1,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    // Counting a run here rather than on the library page means the number
    // reflects "put in a plan", which is the thing worth knowing.
    if (activity) {
      await labDb
        .from("activities")
        .update({ times_run: activity.times_run + 1 })
        .eq("id", activity.id);
    }

    setSlotTitle("");
    setSlotActivity("");
    setSlotMinutes("15");
  }

  async function copyProgramme() {
    if (!active) return;
    const nextWeek = new Date(parseISO(active.meets_on).getTime() + 7 * 86400000)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await labDb.rpc("copy_programme", {
      source_programme_id: active.id,
      new_date: nextWeek,
      new_title: `${active.title} (copy)`,
    });

    if (error) {
      toast.error(error.message);
      return;
    }
    if (typeof data === "string") setActiveId(data);
    toast.success("Copied to next week — now change the two things that are different");
  }

  return (
    <LabPage
      title="Programme"
      description="What happens on the night, with the clock adding itself up."
      feature="programme"
      tabs={GROUP_TABS}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {canEdit && active && (
            <Button variant="outline" size="sm" onClick={copyProgramme}>
              <Copy className="size-4" />
              <span className="hidden sm:inline">Copy</span>
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setProgrammeOpen(true)}>
              <Plus className="size-4" />
              New night
            </Button>
          )}
        </>
      }
    >
      {loading && programmes.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : programmes.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-6" />}
          title="No programmes yet"
          description="Plan a night: a few slots with times on them, drawn from the activity library."
          action={
            canEdit ? (
              <Button size="sm" onClick={() => setProgrammeOpen(true)}>
                <Plus className="size-4" />
                Plan a night
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Select value={active?.id ?? ""} onValueChange={setActiveId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {programmes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {format(parseISO(p.meets_on), "d MMM")} — {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap text-sm text-muted-foreground">Starts</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-28"
              />
            </div>

            {canDelete && active && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                aria-label={`Delete ${active.title}`}
                onClick={async () => {
                  const { error } = await labDb
                    .from("programmes")
                    .delete()
                    .eq("id", active.id);
                  if (error) toast.error(error.message);
                  else setActiveId("");
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>

          {active && (
            <>
              <div>
                <h2 className="text-lg font-medium">{active.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(active.meets_on), "EEEE d MMMM yyyy")}
                  {active.location && ` · ${active.location}`}
                  {active.lead_person && ` · led by ${active.lead_person}`}
                  {" · "}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {totalMinutes} min total
                  </span>
                </p>
                {active.notes && <p className="mt-1 text-sm">{active.notes}</p>}
              </div>

              {activeSlots.length === 0 ? (
                <EmptyState title="Nothing planned yet" description="Add the first slot below." />
              ) : (
                <ol className="overflow-hidden rounded-lg border bg-card">
                  {activeSlots.map((slot, index) => {
                    const activity = slot.activity_id
                      ? activities.find((a) => a.id === slot.activity_id)
                      : null;

                    return (
                      <li
                        key={slot.id}
                        className="flex items-start gap-3 border-b p-3 last:border-b-0"
                      >
                        <span className="w-12 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-muted-foreground">
                          {timings[index]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{slot.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {slot.minutes} min
                            {slot.lead_person && ` · ${slot.lead_person}`}
                          </p>
                          {activity?.kit_needed && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              <strong className="font-medium text-foreground">Kit:</strong>{" "}
                              {activity.kit_needed}
                            </p>
                          )}
                          {activity?.risk_notes && (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                              {activity.risk_notes}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground print:hidden"
                            aria-label={`Remove ${slot.title}`}
                            onClick={async () => {
                              const { error } = await labDb
                                .from("programme_slots")
                                .delete()
                                .eq("id", slot.id);
                              if (error) toast.error(error.message);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              {canEdit && (
                <form
                  onSubmit={addSlot}
                  className="grid gap-2 rounded-lg border p-3 print:hidden sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_6rem_auto]"
                >
                  <div>
                    <Label className="mb-1.5 block text-xs">From the library</Label>
                    <Select
                      value={slotActivity || "none"}
                      onValueChange={(v) => {
                        const id = v === "none" ? "" : v;
                        setSlotActivity(id);
                        const activity = activities.find((a) => a.id === id);
                        if (activity) setSlotMinutes(String(activity.duration_minutes));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pick one" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Something of your own</SelectItem>
                        {activities.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Or type a title</Label>
                    <Input
                      value={slotTitle}
                      onChange={(e) => setSlotTitle(e.target.value)}
                      placeholder="Flag break and notices"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Minutes</Label>
                    <Input
                      inputMode="numeric"
                      value={slotMinutes}
                      onChange={(e) => setSlotMinutes(e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" className="w-full">
                      <Plus className="size-4" />
                      Add
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </>
      )}

      <ProgrammeDialog open={programmeOpen} onOpenChange={setProgrammeOpen} onCreated={setActiveId} />
    </LabPage>
  );
}

function ProgrammeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [meetsOn, setMeetsOn] = useState("");
  const [theme, setTheme] = useState("");
  const [location, setLocation] = useState("");
  const [lead, setLead] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setTheme("");
    setLocation("");
    setLead("");
    setNotes("");
    // Next Thursday, which is when a scout meeting usually is. Wrong for
    // some groups, right for most, and one tap to change either way.
    const now = new Date();
    const daysUntilThursday = (4 - now.getDay() + 7) % 7 || 7;
    setMeetsOn(
      new Date(now.getTime() + daysUntilThursday * 86400000).toISOString().slice(0, 10),
    );
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !meetsOn) return;
    setSaving(true);

    const { data, error } = await labDb
      .from("programmes")
      .insert({
        title: title.trim(),
        meets_on: meetsOn,
        theme: theme.trim() || null,
        location: location.trim() || null,
        lead_person: lead.trim() || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't create the programme");
      return;
    }
    onCreated(data.id);
    toast.success("Created — now add the slots");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Plan a night</DialogTitle>
            <DialogDescription>
              Give it a name and a date; the slots go on afterwards, and the times work
              themselves out from the durations.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div>
              <Label className="mb-1.5 block">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Knots and fire"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Date</Label>
                <Input
                  type="date"
                  value={meetsOn}
                  onChange={(e) => setMeetsOn(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Theme</Label>
                <Input value={theme} onChange={(e) => setTheme(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Where</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="The hut"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">Led by</Label>
                <Input value={lead} onChange={(e) => setLead(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
