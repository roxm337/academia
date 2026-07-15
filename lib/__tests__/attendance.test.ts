import { describe, it, expect } from "vitest";
import {
  weekdayOf,
  isHoliday,
  countsToward,
  unexcusedAbsences,
  crossesThreshold,
  dayNumber,
} from "../attendance";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("weekdayOf", () => {
  it("maps a UTC date to our Weekday enum", () => {
    expect(weekdayOf(utc(2026, 1, 5))).toBe("MONDAY"); // 5 Jan 2026 is a Monday
    expect(weekdayOf(utc(2026, 1, 4))).toBe("SUNDAY");
    expect(weekdayOf(utc(2026, 1, 10))).toBe("SATURDAY");
  });
});

describe("isHoliday", () => {
  const holidays = [{ startDate: utc(2026, 3, 18), endDate: utc(2026, 3, 20) }];
  it("is true inside the span, inclusive of both ends", () => {
    expect(isHoliday(utc(2026, 3, 18), holidays)).toBe(true);
    expect(isHoliday(utc(2026, 3, 19), holidays)).toBe(true);
    expect(isHoliday(utc(2026, 3, 20), holidays)).toBe(true);
  });
  it("is false just outside the span", () => {
    expect(isHoliday(utc(2026, 3, 17), holidays)).toBe(false);
    expect(isHoliday(utc(2026, 3, 21), holidays)).toBe(false);
  });
  it("is false with no holidays", () => {
    expect(isHoliday(utc(2026, 3, 19), [])).toBe(false);
  });
});

describe("countsToward / unexcusedAbsences", () => {
  it("only an unexcused ABSENT counts", () => {
    expect(countsToward({ status: "ABSENT", isExcused: false })).toBe(true);
    expect(countsToward({ status: "ABSENT", isExcused: true })).toBe(false);
    expect(countsToward({ status: "LATE", isExcused: false })).toBe(false);
    expect(countsToward({ status: "PRESENT", isExcused: false })).toBe(false);
  });
  it("tallies only the unexcused absences", () => {
    const records = [
      { status: "ABSENT" as const, isExcused: false },
      { status: "ABSENT" as const, isExcused: false },
      { status: "ABSENT" as const, isExcused: true }, // justified
      { status: "LATE" as const, isExcused: false },
      { status: "PRESENT" as const, isExcused: false },
    ];
    expect(unexcusedAbsences(records)).toBe(2);
  });
});

describe("crossesThreshold — fire the alert exactly once", () => {
  it("fires on the save that reaches the threshold", () => {
    expect(crossesThreshold(4, 5, 5)).toBe(true);
  });
  it("does not fire again once already at or above", () => {
    expect(crossesThreshold(5, 6, 5)).toBe(false);
    expect(crossesThreshold(6, 7, 5)).toBe(false);
  });
  it("fires when the count jumps past the threshold", () => {
    expect(crossesThreshold(3, 6, 5)).toBe(true);
  });
  it("does not fire when the count is unchanged", () => {
    expect(crossesThreshold(5, 5, 5)).toBe(false);
    expect(crossesThreshold(2, 2, 5)).toBe(false);
  });
  it("never fires when the threshold is disabled (0)", () => {
    expect(crossesThreshold(0, 1, 0)).toBe(false);
    expect(crossesThreshold(9, 10, 0)).toBe(false);
  });
});

describe("dayNumber", () => {
  it("ignores the time of day", () => {
    const a = new Date(Date.UTC(2026, 6, 15, 8, 30));
    const b = new Date(Date.UTC(2026, 6, 15, 23, 59));
    expect(dayNumber(a)).toBe(dayNumber(b));
  });
});
