import { describe, it, expect } from "vitest";
import {
  canSeeAnnouncement,
  audienceNeedsTarget,
  type ViewerContext,
} from "../announcements";

function ctx(over: Partial<ViewerContext>): ViewerContext {
  return {
    role: "STUDENT",
    classIds: new Set(),
    levelIds: new Set(),
    cycleIds: new Set(),
    ...over,
  };
}

describe("canSeeAnnouncement", () => {
  it("WHOLE_SCHOOL reaches everyone", () => {
    expect(canSeeAnnouncement({ audience: "WHOLE_SCHOOL" }, ctx({ role: "PARENT" }))).toBe(true);
    expect(canSeeAnnouncement({ audience: "WHOLE_SCHOOL" }, ctx({ role: "TEACHER" }))).toBe(true);
  });

  it("TEACHERS reaches only teachers", () => {
    expect(canSeeAnnouncement({ audience: "TEACHERS" }, ctx({ role: "TEACHER" }))).toBe(true);
    expect(canSeeAnnouncement({ audience: "TEACHERS" }, ctx({ role: "PARENT" }))).toBe(false);
    expect(canSeeAnnouncement({ audience: "TEACHERS" }, ctx({ role: "STUDENT" }))).toBe(false);
  });

  it("PARENTS reaches only parents", () => {
    expect(canSeeAnnouncement({ audience: "PARENTS" }, ctx({ role: "PARENT" }))).toBe(true);
    expect(canSeeAnnouncement({ audience: "PARENTS" }, ctx({ role: "TEACHER" }))).toBe(false);
  });

  it("CLASS reaches only members of that class", () => {
    const a = { audience: "CLASS" as const, classId: "c1" };
    expect(canSeeAnnouncement(a, ctx({ classIds: new Set(["c1"]) }))).toBe(true);
    expect(canSeeAnnouncement(a, ctx({ classIds: new Set(["c2"]) }))).toBe(false);
    expect(canSeeAnnouncement(a, ctx({ classIds: new Set() }))).toBe(false);
  });

  it("LEVEL and CYCLE match on their own id sets", () => {
    expect(canSeeAnnouncement({ audience: "LEVEL", levelId: "l1" }, ctx({ levelIds: new Set(["l1"]) }))).toBe(true);
    expect(canSeeAnnouncement({ audience: "LEVEL", levelId: "l1" }, ctx({ levelIds: new Set(["l2"]) }))).toBe(false);
    expect(canSeeAnnouncement({ audience: "CYCLE", cycleId: "cy1" }, ctx({ cycleIds: new Set(["cy1"]) }))).toBe(true);
    expect(canSeeAnnouncement({ audience: "CYCLE", cycleId: "cy1" }, ctx({ cycleIds: new Set() }))).toBe(false);
  });

  it("a targeted audience with a null target reaches no one", () => {
    expect(canSeeAnnouncement({ audience: "CLASS", classId: null }, ctx({ classIds: new Set(["c1"]) }))).toBe(false);
  });
});

describe("audienceNeedsTarget", () => {
  it("flags which audiences require a specific id", () => {
    expect(audienceNeedsTarget("CLASS")).toBe("class");
    expect(audienceNeedsTarget("LEVEL")).toBe("level");
    expect(audienceNeedsTarget("CYCLE")).toBe("cycle");
    expect(audienceNeedsTarget("WHOLE_SCHOOL")).toBeNull();
    expect(audienceNeedsTarget("TEACHERS")).toBeNull();
    expect(audienceNeedsTarget("PARENTS")).toBeNull();
  });
});
