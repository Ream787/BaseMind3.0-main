import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Plus, Printer, Shuffle, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { labDb } from "@/lib/lab/client";
import { useLabTable, useIndexBy } from "@/lib/lab/useLabTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LabPage } from "@/components/lab/LabPage";
import { EmptyState, PatrolChip } from "@/components/lab/LabUi";
import { CAMP_TABS } from "@/components/layout/SectionTabs";

/**
 * Who cooks, who washes up, and who fetches the wood.
 *
 * A grid of days by duties, because that is the shape it gets drawn in on
 * the back of an envelope every single time. The rota button fills it by
 * rotating the patrols one step per day, which is both what everybody
 * does by hand and the only arrangement nobody argues about.
 */

const DEFAULT_DUTIES = ["Cook", "Wash up", "Wood and water", "Flag", "Latrines"];

export function DutiesPage() {
  const { hasRole } = useAuth();
  const { rows: events } = useRealtimeTable("events", { orderBy: "start_date", ascending: false });
  const { rows: patrols } = useLabTable("patrols", { orderBy: "sort_order" });

  const [eventId, setEventId] = useState("");
  const [newDuty, setNewDuty] = useState("");

  useEffect(() => {
    if (eventId || events.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [...events].reverse().find((e) => e.start_date >= today);
    setEventId(upcoming?.id ?? events[0].id);
  }, [events, eventId]);

  const { rows: duties, loading } = useLabTable("duties", {
    filter: eventId ? { column: "event_id", value: eventId } : null,
    enabled: !!eventId,
  });

  const canEdit = hasRole(["Admin", "Manager", "Member"]);
  const patrolsById = useIndexBy(patrols, "id");
  const event = events.find((e) => e.id === eventId);

  /**
   * How many days the camp runs for, from its own dates — inclusive, so a
   * Friday-to-Sunday camp is three days and not two. A camp with no end
   * date is a single day.
   */
  const dayCount = useMemo(() => {
    if (!event) return 0;
    if (!event.end_date) return 1;
    const days = differenceInCalendarDays(parseISO(event.end_date), parseISO(event.start_date)) + 1;
    return Math.max(1, Math.min(days, 14));
  }, [event]);

  // The duty rows are whatever the camp already has, plus the defaults, so
  // a rota that already exists is never reshaped by a change to the list.
  const dutyNames = useMemo(() => {
    const used = [...new Set(duties.map((d) => d.duty))];
    return used.length > 0 ? used : DEFAULT_DUTIES.slice(0, 3);
  }, [duties]);

  const cell = (day: number, duty: string) =>
    duties.find((d) => d.day_number === day && d.duty === duty) ?? null;

  async function assign(day: number, duty: string, patrolId: string | null) {
    const existing = cell(day, duty);

    if (existing) {
      const { error } = patrolId
        ? await labDb.from("duties").update({ patrol_id: patrolId }).eq("id", existing.id)
        : await labDb.from("duties").delete().eq("id", existing.id);
      if (error) toast.error(error.message);
      return;
    }

    if (!patrolId) return;
    const { error } = await labDb.from("duties").insert({
      event_id: eventId,
      day_number: day,
      duty,
      patrol_id: patrolId,
      member_id: null,
      notes: null,
    });
    if (error) toast.error(error.message);
  }

  /**
   * Rotate the patrols through the duties, one step per day.
   *
   * Deliberately overwrites: the button exists because somebody wants the
   * whole grid filled, and a version that skipped filled cells would leave
   * a half-edited rota looking like a bug.
   */
  async function autoRota() {
    if (patrols.length === 0 || dutyNames.length === 0) return;

    const rows = [];
    for (let day = 1; day <= dayCount; day++) {
      for (const [index, duty] of dutyNames.entries()) {
        const patrol = patrols[(day - 1 + index) % patrols.length];
        rows.push({
          event_id: eventId,
          day_number: day,
          duty,
          patrol_id: patrol.id,
          member_id: null,
          notes: null,
        });
      }
    }

    const { error: clearError } = await labDb.from("duties").delete().eq("event_id", eventId);
    if (clearError) {
      toast.error(clearError.message);
      return;
    }
    const { error } = await labDb.from("duties").insert(rows);
    if (error) toast.error(error.message);
    else toast.success("Rota filled in");
  }

  function addDuty() {
    const name = newDuty.trim();
    if (!name || !eventId) return;
    setNewDuty("");
    // A duty row exists only once something is assigned to it, so adding
    // one means putting the first patrol on day one and letting it be
    // changed from there.
    void assign(1, name, patrols[0]?.id ?? null);
  }

  return (
    <LabPage
      title="Duty roster"
      description="Cooking, washing up and wood, by patrol and by day."
      feature="duties"
      tabs={CAMP_TABS}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          {canEdit && patrols.length > 0 && eventId && (
            <Button size="sm" onClick={autoRota}>
              <Shuffle className="size-4" />
              Fill the rota
            </Button>
          )}
        </>
      }
    >
      {events.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="size-6" />}
          title="No camps yet"
          description="A rota needs a camp with dates on it."
        />
      ) : patrols.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="size-6" />}
          title="No patrols to put on it"
          description="Add patrols on the points page and they become the rota's columns."
        />
      ) : (
        <>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-full max-w-sm print:hidden">
              <SelectValue placeholder="Pick a camp" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} — {format(parseISO(e.start_date), "d MMM yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loading && duties.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b p-2 text-left font-medium">Duty</th>
                    {Array.from({ length: dayCount }, (_, i) => (
                      <th key={i} className="border-b p-2 text-left font-medium">
                        Day {i + 1}
                        {event && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {format(
                              new Date(parseISO(event.start_date).getTime() + i * 86400000),
                              "EEE d MMM",
                            )}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dutyNames.map((duty) => (
                    <tr key={duty}>
                      <th className="border-b p-2 text-left font-medium">
                        <span className="flex items-center gap-2">
                          {duty}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-muted-foreground print:hidden"
                              aria-label={`Remove ${duty} from the rota`}
                              onClick={async () => {
                                const { error } = await labDb
                                  .from("duties")
                                  .delete()
                                  .eq("event_id", eventId)
                                  .eq("duty", duty);
                                if (error) toast.error(error.message);
                              }}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </span>
                      </th>
                      {Array.from({ length: dayCount }, (_, i) => {
                        const day = i + 1;
                        const entry = cell(day, duty);
                        const patrol = entry?.patrol_id ? patrolsById.get(entry.patrol_id) : null;

                        return (
                          <td key={day} className="border-b p-2 align-middle">
                            {canEdit ? (
                              <Select
                                value={entry?.patrol_id ?? "none"}
                                onValueChange={(v) => assign(day, duty, v === "none" ? null : v)}
                              >
                                <SelectTrigger className="h-8 w-full min-w-32 print:hidden">
                                  <SelectValue placeholder="—" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">—</SelectItem>
                                  {patrols.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <PatrolChip patrol={patrol} />
                            )}
                            {/* Printed rotas want the name, not a dropdown. */}
                            <span className="hidden print:inline">{patrol?.name ?? "—"}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canEdit && (
            <div className="flex max-w-sm gap-2 print:hidden">
              <Input
                value={newDuty}
                onChange={(e) => setNewDuty(e.target.value)}
                placeholder="Add another duty"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDuty();
                  }
                }}
              />
              <Button variant="outline" onClick={addDuty} disabled={!newDuty.trim()}>
                <Plus className="size-4" />
                Add
              </Button>
            </div>
          )}
        </>
      )}
    </LabPage>
  );
}
