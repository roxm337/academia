import { describe, it, expect } from "vitest";
import {
  startOfDay,
  endOfDay,
  addDays,
  upcomingWindow,
  overdueCutoff,
  needsSending,
  isPastDue,
} from "../schedule";

const at = (iso: string) => new Date(iso);

describe("startOfDay / endOfDay", () => {
  it("covers the whole local day", () => {
    const noon = at("2026-03-10T12:34:56");
    expect(startOfDay(noon).getHours()).toBe(0);
    expect(startOfDay(noon).getMinutes()).toBe(0);
    expect(endOfDay(noon).getHours()).toBe(23);
    expect(endOfDay(noon).getMilliseconds()).toBe(999);
  });

  it("does not mutate its argument", () => {
    const d = at("2026-03-10T12:00:00");
    startOfDay(d);
    expect(d.getHours()).toBe(12);
  });
});

describe("addDays", () => {
  it("rolls over a month boundary", () => {
    expect(addDays(at("2026-01-31T10:00:00"), 1).getMonth()).toBe(1); // February
  });
  it("goes backwards with a negative count", () => {
    expect(addDays(at("2026-03-01T10:00:00"), -1).getDate()).toBe(28);
  });
});

describe("upcomingWindow", () => {
  it("spans the whole target day, not a 120-hour instant", () => {
    // A job started at 07:00 must still catch an installment due at 23:00.
    const { from, to } = upcomingWindow(at("2026-03-10T07:00:00"), 5);
    expect(from.getDate()).toBe(15);
    expect(from.getHours()).toBe(0);
    expect(to.getDate()).toBe(15);
    expect(to.getHours()).toBe(23);

    const dueLateOnTheDay = at("2026-03-15T23:00:00");
    expect(dueLateOnTheDay >= from && dueLateOnTheDay <= to).toBe(true);
  });

  it("is the same window whatever time of day the job runs", () => {
    const early = upcomingWindow(at("2026-03-10T00:05:00"), 5);
    const late = upcomingWindow(at("2026-03-10T23:55:00"), 5);
    expect(early.from.getTime()).toBe(late.from.getTime());
    expect(early.to.getTime()).toBe(late.to.getTime());
  });
});

describe("overdueCutoff", () => {
  it("includes anything due on or before the cutoff day", () => {
    const cutoff = overdueCutoff(at("2026-03-10T07:00:00"), 3);
    expect(cutoff.getDate()).toBe(7);
    expect(at("2026-03-07T09:00:00") <= cutoff).toBe(true);
    expect(at("2026-03-08T09:00:00") <= cutoff).toBe(false);
  });
});

describe("needsSending", () => {
  const windowStart = at("2026-03-10T00:00:00");

  it("sends when nothing has gone out yet", () => {
    expect(needsSending(null, windowStart)).toBe(true);
    expect(needsSending(undefined, windowStart)).toBe(true);
  });

  it("does not re-send inside the same window", () => {
    // The job running twice in one day must not chase a parent twice.
    expect(needsSending(at("2026-03-10T08:00:00"), windowStart)).toBe(false);
  });

  it("sends again once a new window opens", () => {
    expect(needsSending(at("2026-03-09T08:00:00"), windowStart)).toBe(true);
  });
});

describe("isPastDue", () => {
  const now = at("2026-03-10T07:00:00");
  it("is not past due on the due date itself", () => {
    expect(isPastDue(at("2026-03-10T23:59:00"), now)).toBe(false);
  });
  it("is past due the day after", () => {
    expect(isPastDue(at("2026-03-09T23:59:00"), now)).toBe(true);
  });
});
