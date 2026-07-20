/**
 * Pure date arithmetic for the scheduled jobs.
 *
 * Cron fires these at a wall-clock hour, so every window is computed in whole
 * local days: "due in 5 days" must mean the whole of that day, not a moment
 * exactly 120 hours from when the job happened to start.
 */

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * The day, in full, that falls `daysBefore` days from now — the installments a
 * "pay soon" reminder should cover.
 */
export function upcomingWindow(now: Date, daysBefore: number): { from: Date; to: Date } {
  const target = addDays(startOfDay(now), daysBefore);
  return { from: target, to: endOfDay(target) };
}

/**
 * The cutoff for "late enough to chase": an installment due on or before this
 * instant is overdue by at least `daysAfter` days.
 */
export function overdueCutoff(now: Date, daysAfter: number): Date {
  return endOfDay(addDays(startOfDay(now), -daysAfter));
}

/**
 * Has a notification of this kind already gone out in the current window?
 *
 * The jobs are expected to run more than once — a cron that fires hourly, an
 * admin re-running it by hand, a retry after a crash — so every send is gated
 * on this. Without it the same parent is chased repeatedly for one bill.
 */
export function needsSending(lastSentAt: Date | null | undefined, windowStart: Date): boolean {
  if (!lastSentAt) return true;
  return lastSentAt < windowStart;
}

/** Is `date` strictly before the start of today? */
export function isPastDue(date: Date, now: Date): boolean {
  return startOfDay(date) < startOfDay(now);
}
