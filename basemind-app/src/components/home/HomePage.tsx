import { useMemo } from "react";
import { Link } from "react-router";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import {
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  HandCoins,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useFeatures } from "@/context/FeaturesContext";
import { useRealtimeTable } from "@/lib/useRealtimeTable";
import { loanStatus, todayISO } from "@/lib/loans";
import type { ReactNode } from "react";

/**
 * What needs doing, on one screen.
 *
 * Reached by tapping the wordmark rather than being the landing page: people
 * open this app to do a specific thing — check a box, look up who has the
 * trailer — and putting a dashboard in front of that every time would be a
 * toll on the common case. It is here for the moment you want the overview
 * instead.
 *
 * Every card counts something that is someone's problem today. A card with
 * nothing in it says so quietly rather than showing a zero, because a screen
 * of zeroes reads as broken.
 */
export function HomePage() {
  const { profile } = useAuth();
  const { isEnabled } = useFeatures();

  const { rows: equipment } = useRealtimeTable("equipment", { orderBy: "name" });
  const { rows: loans } = useRealtimeTable("equipment_loans");
  const { rows: faults } = useRealtimeTable("equipment_faults");
  const { rows: events } = useRealtimeTable("events", { orderBy: "start_date" });

  const today = todayISO();

  const dueCheck = useMemo(
    () => equipment.filter((e) => e.next_check_date && e.next_check_date <= today),
    [equipment, today],
  );

  const needsAttention = useMemo(
    () => equipment.filter((e) => e.condition !== "Good"),
    [equipment],
  );

  const overdue = useMemo(
    () => loans.filter((l) => loanStatus(l, today) === "overdue"),
    [loans, today],
  );

  const openFaults = useMemo(() => faults.filter((f) => !f.resolved_on), [faults]);

  const nextCamps = useMemo(
    () => events.filter((e) => (e.end_date ?? e.start_date) >= today).slice(0, 3),
    [events, today],
  );

  const firstName = profile?.name?.trim().split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1>{firstName ? `Hello, ${firstName}` : "Hello"}</h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE d MMMM")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isEnabled("events") && (
          <Card
            to="/events"
            icon={<CalendarDays className="size-4" />}
            title="Next up"
            empty={nextCamps.length === 0 ? "Nothing in the calendar" : null}
          >
            {nextCamps.map((camp) => {
              const days = differenceInCalendarDays(parseISO(camp.start_date), new Date());
              return (
                <div key={camp.id} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate">{camp.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {days <= 0 ? "on now" : days === 1 ? "tomorrow" : `in ${days} days`}
                  </span>
                </div>
              );
            })}
          </Card>
        )}

        {isEnabled("equipment") && (
          <Card
            to="/equipment"
            icon={<ClipboardCheck className="size-4" />}
            title="Due a check"
            empty={dueCheck.length === 0 ? "Everything is in date" : null}
          >
            <p className="text-2xl font-semibold">{dueCheck.length}</p>
            <p className="text-xs text-muted-foreground">
              {dueCheck
                .slice(0, 3)
                .map((e) => e.name)
                .join(", ")}
              {dueCheck.length > 3 && ` and ${dueCheck.length - 3} more`}
            </p>
          </Card>
        )}

        {isEnabled("equipment") && (
          <Card
            to="/repairs"
            icon={<Wrench className="size-4" />}
            title="Broken"
            empty={openFaults.length === 0 && needsAttention.length === 0 ? "Nothing broken" : null}
          >
            <p className="text-2xl font-semibold">{openFaults.length}</p>
            <p className="text-xs text-muted-foreground">
              {openFaults.filter((f) => f.plan === "Undecided").length} still undecided
              {needsAttention.length > 0 &&
                ` · ${needsAttention.length} not in good condition`}
            </p>
          </Card>
        )}

        {isEnabled("loans") && (
          <Card
            to="/loans"
            icon={<HandCoins className="size-4" />}
            title="Overdue back"
            empty={overdue.length === 0 ? "Nothing is late" : null}
          >
            <p className="text-2xl font-semibold text-destructive">{overdue.length}</p>
            <p className="text-xs text-muted-foreground">
              {overdue
                .slice(0, 2)
                .map((l) => l.borrower_name)
                .join(", ")}
              {overdue.length > 2 && ` and ${overdue.length - 2} more`}
            </p>
          </Card>
        )}
      </div>

      {dueCheck.length === 0 &&
        openFaults.length === 0 &&
        overdue.length === 0 &&
        nextCamps.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nothing needs you right now.
          </p>
        )}
    </div>
  );
}

function Card({
  to,
  icon,
  title,
  empty,
  children,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  /** Set when there is nothing to report, and says so instead of a zero. */
  empty: string | null;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary hover:bg-accent/50"
    >
      <div className="flex items-center justify-between gap-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-col gap-1 text-sm">{children}</div>
      )}
    </Link>
  );
}
