import { useMemo, useState } from "react";
import { Link } from "react-router";
import { format, isSameDay, isSameMonth, isToday, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, Sparkles } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { eventsOnDay, monthGridDays, shiftMonth, upcomingEvents } from "@/lib/calendar";
import type { CampEvent } from "@/types/database";
import { Button } from "@/components/ui/button";
import { EventFormDialog } from "@/components/events/EventFormDialog";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function EventsPage() {
  const { hasRole } = useAuth();
  const { rows: events, loading, error } = useRealtimeTable("events", { orderBy: "start_date" });
  const { rows: sites } = useRealtimeTable("camping_sites", { orderBy: "name" });

  const [month, setMonth] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CampEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  const canEdit = hasRole(["Admin", "Manager", "Member"]);

  const days = useMemo(() => monthGridDays(month), [month]);
  const upcoming = useMemo(() => upcomingEvents(events), [events]);
  const sitesById = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  function openAdd(date?: Date) {
    setEditing(null);
    setDefaultDate(date ? format(date, "yyyy-MM-dd") : undefined);
    setDialogOpen(true);
  }

  function dateRangeLabel(event: CampEvent) {
    const start = parseISO(event.start_date);
    if (!event.end_date || event.end_date === event.start_date) {
      return format(start, "d MMM yyyy");
    }
    const end = parseISO(event.end_date);
    return isSameMonth(start, end)
      ? `${format(start, "d")}–${format(end, "d MMM yyyy")}`
      : `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Calendar</h1>
          <p className="text-sm text-muted-foreground">
            {upcoming.length} upcoming {upcoming.length === 1 ? "event" : "events"}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {/* The wizard is for camps, where site/menu/equipment all matter.
                Quick add stays for troop nights and one-off dates. */}
            <Button asChild>
              <Link to="/events/new">
                <Sparkles className="size-4" />
                Plan a camp
              </Link>
            </Button>
            <Button variant="outline" onClick={() => openAdd()}>
              <Plus className="size-4" />
              Quick add
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-medium">{format(month, "MMMM yyyy")}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayEvents = eventsOnDay(events, day);
              const outsideMonth = !isSameMonth(day, month);
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-14 border-b border-r p-1 last:border-r-0 sm:min-h-24 sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${
                    outsideMonth ? "bg-muted/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                        isToday(day)
                          ? "bg-primary font-medium text-primary-foreground"
                          : outsideMonth
                            ? "text-muted-foreground/60"
                            : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {canEdit && !outsideMonth && (
                      <button
                        type="button"
                        onClick={() => openAdd(day)}
                        aria-label={`Add event on ${format(day, "d MMMM yyyy")}`}
                        className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [div:hover>div>&]:opacity-100"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1 flex flex-col gap-1">
                    {dayEvents.map((event) => (
                      <Link
                        key={event.id}
                        to={`/events/${event.id}`}
                        title={event.name}
                        aria-label={event.name}
                        className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary hover:bg-primary/20"
                      >
                        {/* A name won't fit in a 45px-wide cell — on phones the
                            block itself signals "something's on"; the Upcoming
                            list below carries the detail. */}
                        <span className="hidden sm:inline">{event.name}</span>
                        <span className="block h-1 sm:hidden" />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Upcoming</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading events…</p>
          ) : upcoming.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nothing coming up.
            </div>
          ) : (
            upcoming.map((event) => {
              const start = parseISO(event.start_date);
              return (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="flex flex-col gap-1 rounded-lg border bg-card p-3 transition-colors hover:border-primary hover:bg-accent/50"
                >
                  <span className="font-medium">{event.name}</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="size-3.5 shrink-0" />
                    {dateRangeLabel(event)}
                    {isSameDay(start, new Date()) && (
                      <span className="font-medium text-primary">· Today</span>
                    )}
                  </span>
                  {event.site_id && sitesById.has(event.site_id) && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" />
                      {sitesById.get(event.site_id)}
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing}
        sites={sites}
        defaultDate={defaultDate}
      />
    </div>
  );
}
