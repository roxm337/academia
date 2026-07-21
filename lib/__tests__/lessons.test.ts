import { describe, it, expect } from "vitest";
import {
  unitVisibleTo,
  canAuthorAt,
  normalizeSpeciality,
  nextOrder,
  curriculumKey,
} from "../lessons";

const LEVEL = "lvl_tle";
const OTHER_LEVEL = "lvl_1re";
const NSI = "spe_nsi";
const SVT = "spe_svt";

describe("unitVisibleTo", () => {
  it("hides a unit from another level even when the spécialité matches", () => {
    expect(
      unitVisibleTo(
        { levelId: OTHER_LEVEL, specialityId: NSI },
        { levelId: LEVEL, specialityIds: [NSI] },
      ),
    ).toBe(false);
  });

  it("shows a spécialité unit only to the students who chose it", () => {
    // The whole point of the 2019 reform: these two are classmates.
    const unit = { levelId: LEVEL, specialityId: NSI };
    expect(unitVisibleTo(unit, { levelId: LEVEL, specialityIds: [NSI, SVT] })).toBe(true);
    expect(unitVisibleTo(unit, { levelId: LEVEL, specialityIds: [SVT] })).toBe(false);
  });

  it("shows a tronc commun unit to everyone at the level", () => {
    const unit = { levelId: LEVEL, specialityId: null };
    expect(unitVisibleTo(unit, { levelId: LEVEL, specialityIds: [NSI] })).toBe(true);
    expect(unitVisibleTo(unit, { levelId: LEVEL, specialityIds: [] })).toBe(true);
  });

  it("hides a spécialité unit from a level that has none", () => {
    // A collégien has no spécialités at all — a Terminale NSI unit must not
    // reach them even if the level id were somehow shared.
    expect(
      unitVisibleTo({ levelId: LEVEL, specialityId: NSI }, { levelId: LEVEL, specialityIds: [] }),
    ).toBe(false);
  });
});

describe("canAuthorAt", () => {
  const assignments = [{ levelId: LEVEL }, { levelId: OTHER_LEVEL }];

  it("allows a level the teacher is assigned to", () => {
    expect(canAuthorAt(assignments, { levelId: LEVEL })).toBe(true);
  });

  it("refuses a level the teacher does not teach", () => {
    expect(canAuthorAt(assignments, { levelId: "lvl_2nde" })).toBe(false);
  });

  it("refuses everything when the teacher has no assignments", () => {
    expect(canAuthorAt([], { levelId: LEVEL })).toBe(false);
  });
});

describe("normalizeSpeciality", () => {
  it("collapses the empty-ish values to null", () => {
    // An unselected <select> posts "", not undefined.
    expect(normalizeSpeciality("")).toBeNull();
    expect(normalizeSpeciality(undefined)).toBeNull();
    expect(normalizeSpeciality(null)).toBeNull();
    expect(normalizeSpeciality(NSI)).toBe(NSI);
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
  it("treats no-spécialité and empty-string as the same coordinate", () => {
    expect(curriculumKey(LEVEL, null, "sub")).toBe(curriculumKey(LEVEL, "", "sub"));
  });

  it("separates coordinates that differ only by spécialité", () => {
    expect(curriculumKey(LEVEL, NSI, "sub")).not.toBe(curriculumKey(LEVEL, SVT, "sub"));
  });

  it("does not collide when a spécialité is literally named like the sentinel", () => {
    // A ":"-joined key with an "all" sentinel would make these two equal.
    expect(curriculumKey(LEVEL, "all", "sub")).not.toBe(curriculumKey(LEVEL, null, "sub"));
  });
});
