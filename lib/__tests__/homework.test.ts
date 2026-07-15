import { describe, it, expect } from "vitest";
import { isLate, dueStatus } from "../homework";

const at = (iso: string) => new Date(iso);

describe("isLate", () => {
  const due = at("2026-03-10T23:59:00Z");
  it("is late strictly after the deadline", () => {
    expect(isLate(due, at("2026-03-11T00:00:00Z"))).toBe(true);
  });
  it("is on time before or exactly at the deadline", () => {
    expect(isLate(due, at("2026-03-10T20:00:00Z"))).toBe(false);
    expect(isLate(due, at("2026-03-10T23:59:00Z"))).toBe(false);
  });
});

describe("dueStatus", () => {
  const due = at("2026-03-10T12:00:00Z");
  it("is overdue once the deadline has passed", () => {
    expect(dueStatus(due, at("2026-03-10T12:00:01Z"))).toBe("overdue");
  });
  it("is dueSoon within the 48h window", () => {
    expect(dueStatus(due, at("2026-03-09T13:00:00Z"))).toBe("dueSoon");
    expect(dueStatus(due, at("2026-03-08T12:00:00Z"))).toBe("dueSoon"); // exactly 48h
  });
  it("is upcoming beyond the window", () => {
    expect(dueStatus(due, at("2026-03-07T12:00:00Z"))).toBe("upcoming");
  });
});
