import { describe, expect, it } from "vitest";
import {
  requiredSpecialityCount,
  specialitiesApply,
  validateSpecialityChoice,
} from "../specialities";

const OFFERED = ["spe_maths", "spe_pc", "spe_svt", "spe_nsi", "spe_ses"];

describe("requiredSpecialityCount", () => {
  it("is three in Première and two in Terminale", () => {
    expect(requiredSpecialityCount("1RE")).toBe(3);
    expect(requiredSpecialityCount("TLE")).toBe(2);
  });

  it("is zero everywhere else", () => {
    for (const c of ["2NDE", "3E", "CM2", "CP", ""]) {
      expect(requiredSpecialityCount(c)).toBe(0);
      expect(specialitiesApply(c)).toBe(false);
    }
  });
});

describe("validateSpecialityChoice", () => {
  const check = (levelCode: string, chosen: string[]) =>
    validateSpecialityChoice({ levelCode, chosen, offeredIds: OFFERED });

  it("accepts exactly three in Première", () => {
    expect(check("1RE", ["spe_maths", "spe_pc", "spe_svt"])).toEqual({ ok: true });
  });

  it("accepts exactly two in Terminale", () => {
    expect(check("TLE", ["spe_maths", "spe_pc"])).toEqual({ ok: true });
  });

  it("rejects the wrong count", () => {
    // Two in Première, three in Terminale — both the classic data-entry slip.
    expect(check("1RE", ["spe_maths", "spe_pc"])).toEqual({ ok: false, error: "wrongCount" });
    expect(check("TLE", ["spe_maths", "spe_pc", "spe_svt"])).toEqual({ ok: false, error: "wrongCount" });
  });

  it("rejects a spécialité not offered at the level", () => {
    // The interesting hostile case: a real count, but an id from elsewhere.
    expect(check("TLE", ["spe_maths", "spe_from_another_school"])).toEqual({
      ok: false,
      error: "notOffered",
    });
  });

  it("rejects the same spécialité chosen twice", () => {
    expect(check("TLE", ["spe_maths", "spe_maths"])).toEqual({ ok: false, error: "duplicate" });
  });

  it("refuses to save spécialités for a level that has none", () => {
    expect(check("2NDE", ["spe_maths", "spe_pc"])).toEqual({ ok: false, error: "notApplicable" });
  });

  it("allows an empty set — a director clearing a mistaken choice", () => {
    expect(check("1RE", [])).toEqual({ ok: true });
    expect(check("TLE", [])).toEqual({ ok: true });
  });
});
