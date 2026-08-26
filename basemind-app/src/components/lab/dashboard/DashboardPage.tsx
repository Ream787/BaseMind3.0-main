import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { differenceInCalendarDays, format, isPast, parseISO } from "date-fns";
import {
  CalendarDays,
  ListTodo,
  Megaphone,
  Package,
  ShieldAlert,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useLab } from "@/context/LabContext";
import { labDb } from "@/lib/lab/client";
import { useLabTable } from "@/lib/lab/useLabTable";
import type { DashboardCounts, PatrolStanding } from "@/types/lab";
import { LabPage } from "@/components/lab/LabPage";
import { StatCard, hueStyle } from "@/components/lab/LabUi";

/**
 * The screen the app opens on.
 *
 * Every number here comes from one request. The counts are a dozen
 * aggregates over ten tables, and asking for them separately meant a
 * dozen round trips before anything rendered — on the screen most likely
 * to be opened on a phone with one bar of signal, which is the worst
 * possible place to spend them.
 *
 * What it shows is chosen by one rule: a tile earns its place if it is
 * something you would want to be told without asking. Counts that are
 * merely true ("42 pieces of equipment") are down the bottom; things
 * that are wrong and need somebody ("4 loans overdue") are at the top and
 * link straight to the page that fixes them.
 */

export function DashboardPage() {
  const { profile } = useAuth();
  const { isEnabled } = useLab();
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [standings, setStandings] = useState<PatrolStanding[]>([]);

  const { rows: notices } = useLabTable("announcements", {
    orderBy: "created_at",
    ascending: false,
  });
  const { rows: tasks } = useLabTable("tasks", { orderBy: "due_on" });

  const load = useCallback(async () => {
    const [dashboard, patrols] = await Promise.all([
      labDb.rpc("dashboard"),
      labDb.rpc("patrol_standings"),
    ]);
    if (!dashboard.error && dashboard.data) setCounts(dashboard.data as DashboardCounts);
    if (!patrols.error && patrols.data) setStandings(patrols.data as PatrolStanding[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nextEvent = counts?.next_event ?? null;
  const daysAway = nextEvent
    ? differenceInCalendarDays(parseISO(nextEvent.start_date), new Date())
    : null;

  const pinned = useMemo(
    () =>
      notices
        .filter((n) => n.pinned && (!n.expires_on || !isPast(parseISO(n.expires_on))))
        .slice(0, 3),
    [notices],
  );

  const soon = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "Done" && t.due_on)
        .slice(0, 5),
    [tasks],
  );

  /**
   * The things that are actually wrong. An empty list here is the best
   * possible state, so it says so rather than rendering nothing — a blank
   * space reads as "not loaded", not as "nothing to do".
   */
  const problems = [
    counts?.loans_overdue
      ? { text: `${counts.loans_overdue} loan${counts.loans_overdue === 1 ? "" : "s"} overdue`, to: "/loans" }
      : null,
    counts?.tasks_overdue
      ? { text: `${counts.tasks_overdue} camp task${counts.tasks_overdue === 1 ? "" : "s"} past its due date`, to: "/tasks" }
      : null,
    counts?.equipment_needing_repair
      ? {
          text: `${counts.equipment_needing_repair} item${counts.equipment_needing_repair === 1 ? "" : "s"} needing repair or missing`,
          to: "/equipment",
        }
      : null,
  ].filter((p): p is { text: string; to: string } => !!p);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = profile?.name?.trim().split(/\s+/)[0];

  return (
    <LabPage
      title={firstName ? `${greeting}, ${firstName}` : greeting}
      description="Everything that wants looking at, in one place."
      feature="dashboard"
    >
      {nextEvent && (
        <Link
          to={`/events/${nextEvent.id}`}
          className="block rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Next up</p>
          <p className="mt-0.5 text-xl font-semibold">{nextEvent.name}</p>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(nextEvent.start_date), "EEEE d MMMM")}
            {nextEvent.end_date &&
              nextEvent.end_date !== nextEvent.start_date &&
              ` – ${format(parseISO(nextEvent.end_date), "EEEE d MMMM")}`}
            {daysAway !== null && (
              <>
                {" · "}
                <strong className="text-foreground">
                  {daysAway === 0
                    ? "today"
                    : daysAway === 1
                      ? "tomorrow"
                      : `${daysAway} days away`}
                </strong>
              </>
            )}
            {nextEvent.headcount ? ` · ${nextEvent.headcount} going` : ""}
          </p>
        </Link>
      )}

      {problems.length > 0 ? (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="text-sm font-medium">Wants looking at</h2>
          <ul className="mt-2 space-y-1">
            {problems.map((problem) => (
              <li key={problem.to}>
                <Link to={problem.to} className="text-sm text-primary underline">
                  {problem.text}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        counts && (
          <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
            Nothing overdue, nothing broken, nothing waiting. Enjoy it.
          </p>
        )
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {isEnabled("members") && (
          <StatCard
            label="Members"
            value={counts?.members_active ?? "—"}
            hint={counts?.patrols ? `in ${counts.patrols} patrols` : undefined}
            to="/members"
            icon={<Users className="size-4" />}
          />
        )}
        <StatCard
          label="Equipment"
          value={counts?.equipment_items ?? "—"}
          hint={counts?.loans_out ? `${counts.loans_out} out on loan` : "all in the store"}
          to="/equipment"
          icon={<Package className="size-4" />}
        />
        <StatCard
          label="Camps ahead"
          value={counts?.events_upcoming ?? "—"}
          to="/events"
          icon={<CalendarDays className="size-4" />}
        />
        {isEnabled("tasks") && (
          <StatCard
            label="Open tasks"
            value={counts?.tasks_open ?? "—"}
            tone={counts?.tasks_overdue ? "warn" : "default"}
            hint={counts?.tasks_overdue ? `${counts.tasks_overdue} overdue` : undefined}
            to="/tasks"
            icon={<ListTodo className="size-4" />}
          />
        )}
        {isEnabled("progression") && (
          <StatCard
            label="Badges this month"
            value={counts?.badges_awarded_30d ?? "—"}
            to="/progression"
            icon={<Trophy className="size-4" />}
          />
        )}
        {isEnabled("risk") && (
          <StatCard
            label="Incidents (30 days)"
            value={counts?.incidents_30d ?? "—"}
            to="/risk"
            icon={<ShieldAlert className="size-4" />}
          />
        )}
        {isEnabled("wishlist") && (
          <StatCard
            label="Wishlist"
            value={counts?.wishlist_open ?? "—"}
            to="/wishlist"
            icon={<Wrench className="size-4" />}
          />
        )}
        {isEnabled("polls") && (
          <StatCard
            label="Open polls"
            value={counts?.open_polls ?? "—"}
            to="/polls"
            icon={<Megaphone className="size-4" />}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {isEnabled("noticeboard") && pinned.length > 0 && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Megaphone className="size-4 text-muted-foreground" />
              Pinned notices
            </h2>
            <ul className="mt-2 space-y-2">
              {pinned.map((notice) => (
                <li key={notice.id}>
                  <p className="text-sm font-medium">{notice.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{notice.body}</p>
                </li>
              ))}
            </ul>
            <Link to="/noticeboard" className="mt-3 inline-block text-sm text-primary underline">
              The whole board
            </Link>
          </section>
        )}

        {isEnabled("points") && standings.length > 0 && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Trophy className="size-4 text-muted-foreground" />
              Patrol points
            </h2>
            <ol className="mt-2 space-y-1.5">
              {standings.slice(0, 5).map((standing, index) => (
                <li
                  key={standing.patrol_id}
                  className="flex items-center gap-2 text-sm"
                  style={hueStyle(standing.colour)}
                >
                  <span className="w-4 text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="size-2 rounded-full" style={{ backgroundColor: "var(--hue)" }} />
                  <span className="flex-1 truncate">{standing.name}</span>
                  <span className="tabular-nums font-medium">{standing.points}</span>
                </li>
              ))}
            </ol>
            <Link to="/points" className="mt-3 inline-block text-sm text-primary underline">
              The full table
            </Link>
          </section>
        )}

        {isEnabled("tasks") && soon.length > 0 && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <ListTodo className="size-4 text-muted-foreground" />
              Due soon
            </h2>
            <ul className="mt-2 space-y-1.5">
              {soon.map((task) => {
                const late = task.due_on && isPast(parseISO(task.due_on));
                return (
                  <li key={task.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{task.title}</span>
                    <span
                      className={`shrink-0 text-xs tabular-nums ${
                        late ? "font-medium text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {task.due_on && format(parseISO(task.due_on), "d MMM")}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link to="/tasks" className="mt-3 inline-block text-sm text-primary underline">
              The whole board
            </Link>
          </section>
        )}
      </div>
    </LabPage>
  );
}
