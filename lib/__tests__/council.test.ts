import { describe, it, expect } from "vitest";
import {
  COUNCIL_DECISIONS,
  isCouncilDecision,
  suggestDecision,
  buildSnapshot,
  parseBreakdown,
  type SubjectLine,
} from "../council";

const subject = (over: Partial<SubjectLine> = {}): SubjectLine => ({
  subjectId: "sub_math",
  code: "MATH",
  nameAr: "الرياضيات",
  nameFr: "Mathématiques",
  coefficient: 7,
  average: 14.5,
  ...over,
});

describe("isCouncilDecision", () => {
  it("accepts every decision in the vocabulary", () => {
    for (const d of COUNCIL_DECISIONS) expect(isCouncilDecision(d)).toBe(true);
  });
  it("rejects anything else, including free text a form might post", () => {
    expect(isCouncilDecision("FELICITATION")).toBe(false);
    expect(isCouncilDecision("")).toBe(false);
    expect(isCouncilDecision("Très bon trimestre")).toBe(false);
  });
});

describe("suggestDecision", () => {
  it("follows the /20 bands", () => {
    expect(suggestDecision(17)).toBe("FELICITATIONS");
    expect(suggestDecision(16)).toBe("FELICITATIONS");
    expect(suggestDecision(15.99)).toBe("ENCOURAGEMENTS");
    expect(suggestDecision(14)).toBe("ENCOURAGEMENTS");
    expect(suggestDecision(12)).toBe("TABLEAU_HONNEUR");
    expect(suggestDecision(9.99)).toBe("AVERTISSEMENT_TRAVAIL");
  });

  it("suggests nothing in the middle band, where the council must decide", () => {
    expect(suggestDecision(10)).toBeNull();
    expect(suggestDecision(11.9)).toBeNull();
  });

  it("suggests nothing for an ungraded student", () => {
    // No marks is not the same as a bad average — never propose a warning.
    expect(suggestDecision(null)).toBeNull();
  });
});

describe("buildSnapshot", () => {
  const base = {
    general: 14.32,
    rank: 3,
    mention: "BIEN",
    subjects: [subject(), subject({ subjectId: "sub_pc", code: "PC", coefficient: 5, average: 13 })],
    classSize: 28,
    stats: { average: 12.1, min: 6.5, max: 17.8 },
  };

  it("carries every class statistic onto the frozen row", () => {
    const snap = buildSnapshot(base);
    expect(snap.generalAverage).toBe(14.32);
    expect(snap.rank).toBe(3);
    expect(snap.classSize).toBe(28);
    expect(snap.classAverage).toBe(12.1);
    expect(snap.classMin).toBe(6.5);
    expect(snap.classMax).toBe(17.8);
    expect(snap.mention).toBe("BIEN");
  });

  it("freezes the coefficient that applied at the time", () => {
    // A coefficient corrected next year must not restate this semester.
    const snap = buildSnapshot(base);
    expect(snap.subjectBreakdown.subjects[0].coefficient).toBe(7);
  });

  it("keeps both language names so the archive can be reprinted in either", () => {
    const snap = buildSnapshot(base);
    expect(snap.subjectBreakdown.subjects[0].nameAr).toBe("الرياضيات");
    expect(snap.subjectBreakdown.subjects[0].nameFr).toBe("Mathématiques");
  });

  it("normalises a missing appreciation to null rather than dropping the key", () => {
    const snap = buildSnapshot(base);
    expect(snap.subjectBreakdown.subjects[0].appreciation).toBeNull();
  });

  it("preserves an ungraded subject as null, never as zero", () => {
    const snap = buildSnapshot({ ...base, subjects: [subject({ average: null })] });
    expect(snap.subjectBreakdown.subjects[0].average).toBeNull();
  });

  it("handles a student with no marks at all", () => {
    const snap = buildSnapshot({
      ...base,
      general: null,
      rank: null,
      mention: null,
      subjects: [],
    });
    expect(snap.generalAverage).toBeNull();
    expect(snap.subjectBreakdown.subjects).toEqual([]);
  });
});

describe("parseBreakdown", () => {
  it("round-trips what buildSnapshot wrote, through JSON", () => {
    const snap = buildSnapshot({
      general: 14,
      rank: 1,
      mention: "BIEN",
      subjects: [subject()],
      classSize: 10,
      stats: { average: 11, min: 5, max: 18 },
    });
    const restored = parseBreakdown(JSON.parse(JSON.stringify(snap.subjectBreakdown)));
    expect(restored.subjects).toHaveLength(1);
    expect(restored.subjects[0].code).toBe("MATH");
  });

  it("degrades to empty instead of throwing on junk", () => {
    // A malformed archive must not make a bulletin un-printable.
    expect(parseBreakdown(null).subjects).toEqual([]);
    expect(parseBreakdown(undefined).subjects).toEqual([]);
    expect(parseBreakdown("nope").subjects).toEqual([]);
    expect(parseBreakdown({}).subjects).toEqual([]);
    expect(parseBreakdown({ version: 2, subjects: [] }).subjects).toEqual([]);
    expect(parseBreakdown({ version: 1, subjects: "no" }).subjects).toEqual([]);
  });
});
