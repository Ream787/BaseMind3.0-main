import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import type { CampEvent } from "@/types/database";

/** Weeks are Monday-first, matching UK/SA convention. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

/** The full grid of days to render for a month, padded to whole weeks. */
export function monthGridDays(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), WEEK_OPTIONS),
    end: endOfWeek(endOfMonth(month), WEEK_OPTIONS),
  });
}

export function shiftMonth(month: Date, delta: number): Date {
  return addMonths(month, delta);
}

/** An event covers every day from start to end inclusive; end is optional. */
export function eventCoversDay(event: CampEvent, day: Date): boolean {
  const start = startOfDay(parseISO(event.start_date));
  const end = startOfDay(parseISO(event.end_date ?? event.start_date));
  return isWithinInterval(startOfDay(day), { start, end });
}

export function eventsOnDay(events: CampEvent[], day: Date): CampEvent[] {
  return events.filter((event) => eventCoversDay(event, day));
}

/**
 * Events that haven't finished yet, soonest first. An event running right now
 * still counts as upcoming until its last day has passed.
 */
export function upcomingEvents(events: CampEvent[], today = new Date()): CampEvent[] {
  const cutoff = startOfDay(today);
  return events
    .filter((event) => startOfDay(parseISO(event.end_date ?? event.start_date)) >= cutoff)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}
