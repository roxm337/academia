/**
 * Attendance domain logic — pure and client-safe, so the marking UI, the Server
 * Action and the tests agree on what counts as an absence and when a parent
 * gets alerted.
 */

import type { Weekday } from "@/lib/timetable";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

/** JS getUTCDay() (0=Sun..6=Sat) -> our Weekday enum. */
const JS_DAY_TO_WEEKDAY: Weekday[] = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
];

export function weekdayOf(date: Date): Weekday {
  return JS_DAY_TO_WEEKDAY[date.getUTCDay()];
}

/** A calendar day falls inside a holiday if it's within any [start,end] span. */
export function isHoliday(
  date: Date,
  holidays: { startDate: Date; endDate: Date }[],
): boolean {
  const day = dayNumber(date);
  return holidays.some(
    (h) => day >= dayNumber(h.startDate) && day <= dayNumber(h.endDate),
  );
}

/**
 * Only an unexcused ABSENT counts toward the alert threshold. A justified
 * absence and a late arrival do not — the alert is "your child is missing
 * school without reason", not "your child was ever not in a seat".
 */
export function countsToward(record: {
  status: AttendanceStatus;
  isExcused: boolean;
}): boolean {
  return record.status === "ABSENT" && !record.isExcused;
}

export function unexcusedAbsences(
  records: { status: AttendanceStatus; isExcused: boolean }[],
): number {
  return records.filter(countsToward).length;
}

/**
 * True when this save is the one that *crosses* the threshold — so the alert
 * fires once, not on every subsequent absence. `threshold` of 5 alerts as the
 * count goes from 4 to 5, never again at 6, 7…
 */
export function crossesThreshold(
  previousCount: number,
  newCount: number,
  threshold: number,
): boolean {
  return threshold > 0 && previousCount < threshold && newCount >= threshold;
}

/** Day-precision integer (UTC) for date comparisons free of time-of-day noise. */
export function dayNumber(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
