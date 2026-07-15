import { describe, it, expect } from "vitest";
import {
  round2,
  normalizeTo20,
  subjectAverage,
  generalAverage,
  mentionFor,
  rankByAverage,
  classStats,
} from "../grades";

describe("round2", () => {
  it("rounds to two decimals", () => {
    expect(round2(13.005)).toBe(13.01);
    expect(round2(12.344)).toBe(12.34);
    expect(round2(12.345)).toBe(12.35);
    expect(round2(10)).toBe(10);
  });
});

describe("normalizeTo20", () => {
  it("scales any max onto /20", () => {
    expect(normalizeTo20(20, 40)).toBe(10);
    expect(normalizeTo20(15, 20)).toBe(15);
    expect(normalizeTo20(5, 10)).toBe(10);
  });
  it("passes null through and guards a non-positive max", () => {
    expect(normalizeTo20(null, 20)).toBeNull();
    expect(normalizeTo20(10, 0)).toBeNull();
  });
});

describe("subjectAverage", () => {
  it("is the weighted mean of graded items on /20", () => {
    // 12/20 (w1) and 16/20 (w1) -> 14
    expect(
      subjectAverage([
        { score: 12, maxScore: 20, weight: 1 },
        { score: 16, maxScore: 20, weight: 1 },
      ]),
    ).toBe(14);
  });
  it("honours item weights", () => {
    // 10 (w1) and 16 (w3) -> (10 + 48)/4 = 14.5
    expect(
      subjectAverage([
        { score: 10, maxScore: 20, weight: 1 },
        { score: 16, maxScore: 20, weight: 3 },
      ]),
    ).toBe(14.5);
  });
  it("normalizes a differently-scaled item first", () => {
    // 30/40 -> 15, with 15/20 -> mean 15
    expect(
      subjectAverage([
        { score: 30, maxScore: 40, weight: 1 },
        { score: 15, maxScore: 20, weight: 1 },
      ]),
    ).toBe(15);
  });
  it("skips ungraded items rather than treating them as zero", () => {
    expect(
      subjectAverage([
        { score: 14, maxScore: 20, weight: 1 },
        { score: null, maxScore: 20, weight: 1 },
      ]),
    ).toBe(14);
  });
  it("is null when nothing is graded", () => {
    expect(subjectAverage([{ score: null, maxScore: 20, weight: 1 }])).toBeNull();
    expect(subjectAverage([])).toBeNull();
  });
});

describe("generalAverage — coefficient weighted", () => {
  it("computes Σ(avg×coef)/Σ(coef)", () => {
    // 15×2 + 10×1 = 40, /3 = 13.33
    expect(
      generalAverage([
        { average: 15, coefficient: 2 },
        { average: 10, coefficient: 1 },
      ]),
    ).toBe(13.33);
  });
  it("drops subjects with no average from both sides of the ratio", () => {
    // only the 12×3 subject counts -> 12
    expect(
      generalAverage([
        { average: 12, coefficient: 3 },
        { average: null, coefficient: 5 },
      ]),
    ).toBe(12);
  });
  it("is null when no subject has an average", () => {
    expect(
      generalAverage([{ average: null, coefficient: 2 }]),
    ).toBeNull();
  });
});

describe("mentionFor", () => {
  it("maps averages to Moroccan bands at the boundaries", () => {
    expect(mentionFor(16)).toBe("TRES_BIEN");
    expect(mentionFor(15.99)).toBe("BIEN");
    expect(mentionFor(14)).toBe("BIEN");
    expect(mentionFor(13.99)).toBe("ASSEZ_BIEN");
    expect(mentionFor(12)).toBe("ASSEZ_BIEN");
    expect(mentionFor(11.99)).toBe("PASSABLE");
    expect(mentionFor(10)).toBe("PASSABLE");
    expect(mentionFor(9.99)).toBe("INSUFFISANT");
    expect(mentionFor(0)).toBe("INSUFFISANT");
  });
  it("is null with no average", () => {
    expect(mentionFor(null)).toBeNull();
  });
});

describe("rankByAverage — competition ranking", () => {
  it("orders highest first and numbers 1..n", () => {
    const r = rankByAverage([
      { id: "a", average: 12 },
      { id: "b", average: 15 },
      { id: "c", average: 9 },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
    ]);
  });
  it("ties share a rank and the next rank skips (1,2,2,4)", () => {
    const r = rankByAverage([
      { id: "a", average: 18 },
      { id: "b", average: 14 },
      { id: "c", average: 14 },
      { id: "d", average: 11 },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });
  it("leaves students with no average unranked, at the end", () => {
    const r = rankByAverage([
      { id: "a", average: null },
      { id: "b", average: 13 },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([
      ["b", 1],
      ["a", null],
    ]);
  });
  it("treats equal 2-decimal averages as a genuine tie", () => {
    const r = rankByAverage([
      { id: "a", average: 13.5 },
      { id: "b", average: 13.5 },
    ]);
    expect(r.map((x) => x.rank)).toEqual([1, 1]);
  });
});

describe("classStats", () => {
  it("summarizes the graded averages", () => {
    expect(classStats([10, 12, 14])).toEqual({
      count: 3,
      average: 12,
      min: 10,
      max: 14,
    });
  });
  it("ignores nulls and handles an empty class", () => {
    expect(classStats([null, 16, null])).toEqual({
      count: 1, average: 16, min: 16, max: 16,
    });
    expect(classStats([]).average).toBeNull();
  });
});
