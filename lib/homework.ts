/**
 * Homework timing — pure and client-safe, so "is this late?" and "is this due
 * soon?" mean the same thing in the teacher's list, the student's badge and the
 * tests.
 */

export type DueStatus = "upcoming" | "dueSoon" | "overdue";

const DUE_SOON_MS = 48 * 60 * 60 * 1000; // 48h window

/**
 * A submission is late when it lands after the deadline. Equality (submitted at
 * the exact due instant) is on time — the student made it.
 */
export function isLate(dueAt: Date, submittedAt: Date): boolean {
  return submittedAt.getTime() > dueAt.getTime();
}

/**
 * Where a not-yet-submitted homework sits relative to `now`: already overdue,
 * due within 48h, or comfortably upcoming. Drives the colour of the badge, not
 * any permission — so it's purely presentational.
 */
export function dueStatus(dueAt: Date, now: Date): DueStatus {
  const delta = dueAt.getTime() - now.getTime();
  if (delta < 0) return "overdue";
  if (delta <= DUE_SOON_MS) return "dueSoon";
  return "upcoming";
}
