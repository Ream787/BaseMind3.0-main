import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarCheck, ClipboardList, Printer, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { labDb } from "@/lib/lab/client";
import { useLabTable, useIndexBy } from "@/lib/lab/useLabTable";
import { ATTENDANCE_STATUSES } from "@/types/lab";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState, MemberAvatar, PatrolChip, StatCard } from "@/components/lab/LabUi";
import { GROUP_TABS } from "@/components/layout/SectionTabs";

/**
 * Who is coming, who has paid, and whose form is still outstanding.
 *
 * The register is filled in by a database function rather than by this
 * page: "put every active member on the list as Unknown" is one statement
 * that either happens or does not, and doing it as thirty inserts from a
 * phone on a car park's worth of signal is how you end up with a register
 * that is two-thirds there.
 *
 * The dietary summary at the bottom is the reason this page earns a link
 * from the food section — it is the same list the shopping is done from.
 */

const STATUS_STYLES: Record<string, string> = {
  Coming: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  "Not coming": "bg-destructive/15 text-destructive",
  Maybe: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  Unknown: "bg-muted text-muted-foreground",
};

export function AttendancePage() {
  const { hasRole } = useAuth();
  const { rows: events } = useRealtimeTable("events", { orderBy: "start_date", ascending: false });
  const { rows: members } = useLabTable("members", { orderBy: "first_name" });
  const { rows: patrols } = useLabTable("patrols", { orderBy: "sort_order" });

  const [eventId, setEventId] = useState("");
  const [rolling, setRolling] = useState(false);

  // Default to the next camp that has not happened, falling back to the
  // most recent — which is what somebody opening this page on a Monday
  // morning is almost always looking at.
  useEffect(() => {
    if (eventId || events.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [...events].reverse().find((e) => e.start_date >= today);
    setEventId(upcoming?.id ?? events[0].id);
  }, [events, eventId]);

  const { rows: attendance, loading } = useLabTable("attendance", {
    filter: eventId ? { column: "event_id", value: eventId } : null,
    enabled: !!eventId,
  });

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const patrolsById = useIndexBy(patrols, "id");
  const membersById = useIndexBy(members, "id");
  const event = events.find((e) => e.id === eventId);

  const rows = useMemo(() => {
    return attendance
      .map((entry) => ({ entry, member: membersById.get(entry.member_id) }))
      .filter((row): row is { entry: (typeof attendance)[number]; member: NonNullable<typeof row.member> } => !!row.member)
      .sort((a, b) => {
        const patrolA = a.member.patrol_id ? patrolsById.get(a.member.patrol_id)?.sort_order ?? 99 : 99;
        const patrolB = b.member.patrol_id ? patrolsById.get(b.member.patrol_id)?.sort_order ?? 99 : 99;
        if (patrolA !== patrolB) return patrolA - patrolB;
        return a.member.first_name.localeCompare(b.member.first_name);
      });
  }, [attendance, membersById, patrolsById]);

  const counts = useMemo(() => {
    const tally = { Coming: 0, "Not coming": 0, Maybe: 0, Unknown: 0 } as Record<string, number>;
    for (const { entry } of rows) tally[entry.status] = (tally[entry.status] ?? 0) + 1;
    return tally;
  }, [rows]);

  const paidCount = rows.filter((r) => r.entry.paid).length;
  const formsIn = rows.filter((r) => r.entry.consent_form_in).length;

  /**
   * What the catering actually needs: every dietary requirement and
   * allergy belonging to somebody who said they are coming, and nobody
   * who is not. Counting the whole roster here has cooked forty meals for
   * a camp of twenty more than once.
   */
  const dietary = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { entry, member } of rows) {
      if (entry.status !== "Coming") continue;
      for (const note of [member.dietary_notes, member.allergies]) {
        if (!note?.trim()) continue;
        const key = note.trim();
        const list = map.get(key) ?? [];
        list.push(`${member.first_name} ${member.last_name}`);
        map.set(key, list);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  async function setStatus(entryId: string, status: string) {
    const { error } = await labDb.from("attendance").update({ status }).eq("id", entryId);
    if (error) toast.error(error.message);
  }

  async function setFlag(entryId: string, field: "paid" | "consent_form_in", value: boolean) {
    // Spelled out rather than a computed key: a computed key widens the
    // patch to "some string" and loses the column check that stops a typo
    // silently updating nothing.
    const patch = field === "paid" ? { paid: value } : { consent_form_in: value };
    const { error } = await labDb.from("attendance").update(patch).eq("id", entryId);
    if (error) toast.error(error.message);
  }

  async function rollCall() {
    if (!eventId) return;
    setRolling(true);
    const { data, error } = await labDb.rpc("roll_call", { target_event_id: eventId });
    setRolling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const added = typeof data === "number" ? data : 0;
    toast.success(
      added === 0 ? "Everybody was already on the list" : `${added} added to the register`,
    );
  }

  return (
    <LabPage
      title="Attendance"
      description="Who is coming to what, who has paid, and whose form is still outstanding."
      feature="attendance"
      tabs={GROUP_TABS}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {canEdit && eventId && (
            <Button size="sm" onClick={rollCall} disabled={rolling}>
              <ClipboardList className="size-4" />
              {rolling ? "Filling…" : "Roll call"}
            </Button>
          )}
        </>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="size-6" />}
          title="No camps or meetings yet"
          description="Attendance hangs off the calendar — add an event first and it will show up here."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Pick an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {format(parseISO(e.start_date), "d MMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {event && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Coming" value={counts.Coming ?? 0} tone="good" />
              <StatCard
                label="Not heard from"
                value={counts.Unknown ?? 0}
                tone={(counts.Unknown ?? 0) > 0 ? "warn" : "default"}
                hint={counts.Maybe ? `${counts.Maybe} maybe` : undefined}
              />
              <StatCard label="Paid" value={`${paidCount}/${counts.Coming ?? 0}`} />
              <StatCard label="Forms in" value={`${formsIn}/${counts.Coming ?? 0}`} />
            </div>
          )}

          {loading && rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="Nobody on this register yet"
              description="Roll call puts every active member on the list as “not heard from”, so taking attendance is ticking rather than typing."
              action={
                canEdit ? (
                  <Button size="sm" onClick={rollCall} disabled={rolling}>
                    <ClipboardList className="size-4" />
                    Roll call
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card">
              {rows.map(({ entry, member }) => {
                const patrol = member.patrol_id ? patrolsById.get(member.patrol_id) : null;
                return (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap"
                  >
                    <MemberAvatar member={member} patrol={patrol} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.first_name} {member.last_name}
                      </p>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <PatrolChip patrol={patrol} />
                        {member.allergies && (
                          <span className="text-xs font-medium text-destructive">
                            {member.allergies}
                          </span>
                        )}
                        {member.dietary_notes && (
                          <span className="text-xs text-muted-foreground">
                            {member.dietary_notes}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex rounded-md border p-0.5">
                        {ATTENDANCE_STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setStatus(entry.id, status)}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                              entry.status === status
                                ? STATUS_STYLES[status]
                                : "text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {status === "Not coming" ? "No" : status === "Unknown" ? "?" : status}
                          </button>
                        ))}
                      </div>

                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox
                          checked={entry.paid}
                          disabled={!canEdit}
                          onCheckedChange={(v) => setFlag(entry.id, "paid", v === true)}
                        />
                        Paid
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox
                          checked={entry.consent_form_in}
                          disabled={!canEdit}
                          onCheckedChange={(v) =>
                            setFlag(entry.id, "consent_form_in", v === true)
                          }
                        />
                        Form
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {dietary.length > 0 && (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="flex items-center gap-2 font-medium">
                <UtensilsCrossed className="size-4 text-muted-foreground" />
                What the catering needs
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Only the people who said they are coming. {counts.Coming ?? 0} to cook for.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {dietary.map(([note, people]) => (
                  <li key={note} className="flex flex-wrap gap-x-2">
                    <strong className="shrink-0">
                      {note} × {people.length}
                    </strong>
                    <span className="text-muted-foreground">{people.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </LabPage>
  );
}
