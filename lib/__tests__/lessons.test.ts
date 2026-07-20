import { describe, it, expect } from "vitest";
import {
  unitVisibleTo,
  canAuthorAt,
  normalizeStream,
  nextOrder,
  curriculumKey,
} from "../lessons";

const LEVEL = "lvl_2bac";
const OTHER_LEVEL = "lvl_1bac";
const PC = "str_pc";
const SVT = "str_svt";

describe("unitVisibleTo", () => {
  it("hides a unit from another level even when the stream matches", () => {
    expect(
      unitVisibleTo({ levelId: OTHER_LEVEL, streamId: PC }, { levelId: LEVEL, streamId: PC }),
    ).toBe(false);
  });

  it("shows a stream-specific unit only to that stream", () => {
    const unit = { levelId: LEVEL, streamId: PC };
    expect(unitVisibleTo(unit, { levelId: LEVEL, streamId: PC })).toBe(true);
    expect(unitVisibleTo(unit, { levelId: LEVEL, streamId: SVT })).toBe(false);
  });

  it("shows a level-wide unit (no stream) to every stream at that level", () => {
    const unit = { levelId: LEVEL, streamId: null };
    expect(unitVisibleTo(unit, { levelId: LEVEL, streamId: PC })).toBe(true);
    expect(unitVisibleTo(unit, { levelId: LEVEL, streamId: SVT })).toBe(true);
    expect(unitVisibleTo(unit, { levelId: LEVEL, streamId: null })).toBe(true);
  });

  it("hides a stream-specific unit from a class that has no stream", () => {
    // Collège has no streams — a lycée PC unit must not leak into it.
    expect(
      unitVisibleTo({ levelId: LEVEL, streamId: PC }, { levelId: LEVEL, streamId: null }),
    ).toBe(false);
  });
});

describe("canAuthorAt", () => {
  const assignments = [
    { levelId: LEVEL, streamId: PC },
    { levelId: OTHER_LEVEL, streamId: null },
  ];

  it("allows a coordinate the teacher is assigned to", () => {
    expect(canAuthorAt(assignments, { levelId: LEVEL, streamId: PC })).toBe(true);
  });

  it("refuses another stream at the same level", () => {
    expect(canAuthorAt(assignments, { levelId: LEVEL, streamId: SVT })).toBe(false);
  });

  it("refuses a level the teacher does not teach", () => {
    expect(canAuthorAt(assignments, { levelId: "lvl_tc", streamId: null })).toBe(false);
  });

  it("treats an empty-string stream from the form as no stream", () => {
    // An unselected <select> posts "", not undefined — it must match the
    // null-stream assignment and must NOT match a real stream.
    expect(canAuthorAt(assignments, { levelId: OTHER_LEVEL, streamId: "" })).toBe(true);
    expect(canAuthorAt(assignments, { levelId: OTHER_LEVEL, streamId: undefined })).toBe(true);
    expect(canAuthorAt(assignments, { levelId: LEVEL, streamId: "" })).toBe(false);
  });

  it("refuses everything when the teacher has no assignments", () => {
    expect(canAuthorAt([], { levelId: LEVEL, streamId: PC })).toBe(false);
  });
});

describe("normalizeStream", () => {
  it("collapses the empty-ish values to null", () => {
    expect(normalizeStream("")).toBeNull();
    expect(normalizeStream(undefined)).toBeNull();
    expect(normalizeStream(null)).toBeNull();
    expect(normalizeStream(PC)).toBe(PC);
  });
});

describe("nextOrder", () => {
  it("starts an empty unit at 0", () => {
    expect(nextOrder(null)).toBe(0);
    expect(nextOrder(undefined)).toBe(0);
  });
  it("appends after the highest existing position", () => {
    expect(nextOrder(0)).toBe(1);
    expect(nextOrder(7)).toBe(8);
  });
});

describe("curriculumKey", () => {
  it("treats no-stream and empty-string stream as the same coordinate", () => {
    expect(curriculumKey(LEVEL, null, "sub")).toBe(curriculumKey(LEVEL, "", "sub"));
  });

  it("separates coordinates that differ only by stream", () => {
    expect(curriculumKey(LEVEL, PC, "sub")).not.toBe(curriculumKey(LEVEL, SVT, "sub"));
  });

  it("does not collide when a stream is literally named like the sentinel", () => {
    // A ":"-joined key with an "all" sentinel would make these two equal.
    expect(curriculumKey(LEVEL, "all", "sub")).not.toBe(curriculumKey(LEVEL, null, "sub"));
  });
});
