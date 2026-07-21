import { describe, it, expect } from "vitest";
import {
  detectConflicts,
  labelToMin,
  minToLabel,
  periodIndexFor,
  rangesOverlap,
  PERIODS,
  WEEKDAYS,
  type SlotShape,
} from "../timetable";

/** A Monday lesson 09:00–10:00 for one class/teacher/room, overridable. */
function slot(over: Partial<SlotShape> = {}): SlotShape {
  return {
    id: "cand",
    weekday: "MONDAY",
    startMin: 9 * 60,
    endMin: 10 * 60,
    classId: "classA",
    teacherId: "teach1",
    roomId: "room1",
    ...over,
  };
}

describe("time helpers", () => {
  it("formats minutes as zero-padded HH:MM", () => {
    expect(minToLabel(480)).toBe("08:00");
    expect(minToLabel(13 * 60 + 30)).toBe("13:30");
    expect(minToLabel(0)).toBe("00:00");
  });

  it("parses HH:MM back to minutes and rejects junk", () => {
    expect(labelToMin("08:00")).toBe(480);
    expect(labelToMin("13:30")).toBe(810);
    expect(labelToMin("24:61")).toBeNull();
    expect(labelToMin("noon")).toBeNull();
    expect(labelToMin("")).toBeNull();
  });

  it("round-trips every period boundary", () => {
    for (const p of PERIODS) {
      expect(labelToMin(minToLabel(p.startMin))).toBe(p.startMin);
      expect(labelToMin(minToLabel(p.endMin))).toBe(p.endMin);
    }
  });
});

describe("rangesOverlap", () => {
  it("treats touching edges as non-overlapping (half-open)", () => {
    expect(rangesOverlap(540, 600, 600, 660)).toBe(false); // 09–10 vs 10–11
    expect(rangesOverlap(540, 600, 480, 540)).toBe(false); // 09–10 vs 08–09
  });
  it("catches genuine overlap, including containment", () => {
    expect(rangesOverlap(540, 600, 570, 630)).toBe(true);
    expect(rangesOverlap(540, 660, 570, 600)).toBe(true); // fully inside
  });
});

describe("periodIndexFor", () => {
  it("maps a start time to its band", () => {
    expect(periodIndexFor(9 * 60, PERIODS)).toBe(1);
    expect(periodIndexFor(8 * 60, PERIODS)).toBe(0);
  });
  it("returns null for a time in no band (e.g. lunch)", () => {
    expect(periodIndexFor(13 * 60 + 30, PERIODS)).toBeNull();
  });
});

describe("detectConflicts", () => {
  it("finds no conflict against an empty timetable", () => {
    expect(detectConflicts(slot(), [])).toEqual([]);
  });

  it("flags the class being in two places at once", () => {
    const existing = slot({
      id: "x",
      teacherId: "OTHER",
      roomId: "OTHER",
    });
    const kinds = detectConflicts(slot(), [existing]).map((c) => c.kind);
    expect(kinds).toEqual(["class"]);
  });

  it("flags a double-booked teacher across different classes", () => {
    const existing = slot({ id: "x", classId: "classB", roomId: "OTHER" });
    const kinds = detectConflicts(slot(), [existing]).map((c) => c.kind);
    expect(kinds).toEqual(["teacher"]);
  });

  it("flags a double-booked room across different classes/teachers", () => {
    const existing = slot({ id: "x", classId: "classB", teacherId: "OTHER" });
    const kinds = detectConflicts(slot(), [existing]).map((c) => c.kind);
    expect(kinds).toEqual(["room"]);
  });

  it("reports every distinct clash at once", () => {
    const existing = slot({ id: "x" }); // same class, teacher AND room
    const kinds = detectConflicts(slot(), [existing]).map((c) => c.kind).sort();
    expect(kinds).toEqual(["class", "room", "teacher"]);
  });

  it("does not clash when the times only touch", () => {
    const existing = slot({ id: "x", startMin: 10 * 60, endMin: 11 * 60 });
    expect(detectConflicts(slot(), [existing])).toEqual([]);
  });

  it("does not clash on a different weekday", () => {
    const existing = slot({ id: "x", weekday: "TUESDAY" });
    expect(detectConflicts(slot(), [existing])).toEqual([]);
  });


  it("never conflicts with itself when editing in place", () => {
    const self = slot({ id: "same" });
    const moved = slot({ id: "same", startMin: 9 * 60 + 15 }); // overlaps its old self
    expect(detectConflicts(moved, [self])).toEqual([]);
  });

  it("ignores a null room on either side (no room, no room clash)", () => {
    const cand = slot({ roomId: null });
    const existing = slot({ id: "x", classId: "classB", teacherId: "OTHER", roomId: null });
    expect(detectConflicts(cand, [existing])).toEqual([]);
  });
});


describe("the school week", () => {
  it("runs Monday to Friday", () => {
    // France has no Saturday morning: a grid with a Saturday column would
    // invite the director to place a lesson nobody turns up to.
    expect(WEEKDAYS).toEqual([
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
    ]);
  });
});
