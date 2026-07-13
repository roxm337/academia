import { describe, it, expect } from "vitest";
import {
  CODE_MASSAR_RE,
  IMPORT_FIELDS,
  REQUIRED_FIELDS,
  guessMapping,
  isValidCodeMassar,
  normalizeCodeMassar,
  normalizeHeader,
  parseBirthDate,
  parseGender,
  validateRows,
  type ImportField,
  type SheetData,
} from "../massar";

/** ISO day string in UTC — parseBirthDate builds UTC-midnight dates. */
function iso(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Mapping built from a header list, for readable validateRows fixtures. */
function mappingOf(fields: (ImportField | "")[]): Record<number, ImportField | ""> {
  return Object.fromEntries(fields.map((f, i) => [i, f]));
}

describe("normalizeCodeMassar", () => {
  it("uppercases", () => {
    expect(normalizeCodeMassar("a123456789")).toBe("A123456789");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCodeMassar(" A123456789 ")).toBe("A123456789");
  });

  it("strips interior whitespace", () => {
    expect(normalizeCodeMassar("A 123 456 789")).toBe("A123456789");
    expect(normalizeCodeMassar("\tA123456789\n")).toBe("A123456789");
  });

  it("leaves an already-normal code untouched", () => {
    expect(normalizeCodeMassar("A123456789")).toBe("A123456789");
  });

  it("does not invent characters for an empty string", () => {
    expect(normalizeCodeMassar("")).toBe("");
    expect(normalizeCodeMassar("   ")).toBe("");
  });
});

describe("isValidCodeMassar", () => {
  it("accepts one letter followed by nine digits", () => {
    expect(isValidCodeMassar("A123456789")).toBe(true);
    expect(isValidCodeMassar("Z000000000")).toBe(true);
  });

  it("accepts a lowercase code by normalizing first", () => {
    expect(isValidCodeMassar("a123456789")).toBe(true);
  });

  it("accepts a code padded with whitespace", () => {
    expect(isValidCodeMassar(" A123456789 ")).toBe(true);
    expect(isValidCodeMassar("A 123456789")).toBe(true);
  });

  it("rejects too few digits", () => {
    expect(isValidCodeMassar("A12345678")).toBe(false);
    expect(isValidCodeMassar("A1")).toBe(false);
  });

  it("rejects too many digits", () => {
    expect(isValidCodeMassar("A1234567890")).toBe(false);
  });

  it("rejects a missing leading letter", () => {
    expect(isValidCodeMassar("1123456789")).toBe(false);
    expect(isValidCodeMassar("123456789")).toBe(false);
  });

  it("rejects two leading letters", () => {
    expect(isValidCodeMassar("AB12345678")).toBe(false);
    expect(isValidCodeMassar("AB123456789")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidCodeMassar("")).toBe(false);
    expect(isValidCodeMassar("   ")).toBe(false);
  });

  it("rejects symbols and punctuation", () => {
    expect(isValidCodeMassar("A123-456789")).toBe(false);
    expect(isValidCodeMassar("A12345678!")).toBe(false);
    expect(isValidCodeMassar("*123456789")).toBe(false);
  });

  it("rejects a trailing letter after nine digits", () => {
    expect(isValidCodeMassar("A123456789X")).toBe(false);
  });

  it("is anchored — no substring match inside a longer string", () => {
    expect(CODE_MASSAR_RE.test("XX A123456789 XX")).toBe(false);
    expect(isValidCodeMassar("prefixA123456789")).toBe(false);
  });
});

describe("normalizeHeader", () => {
  it("lowercases", () => {
    expect(normalizeHeader("NOM")).toBe("nom");
  });

  it("strips French accents", () => {
    expect(normalizeHeader("Prénom")).toBe("prenom");
    expect(normalizeHeader("Prénom Arabe")).toBe("prenom arabe");
    expect(normalizeHeader("Élève")).toBe("eleve");
    expect(normalizeHeader("Date de naissance")).toBe("date de naissance");
  });

  it("turns punctuation and underscores into spaces", () => {
    expect(normalizeHeader("code_massar")).toBe("code massar");
    expect(normalizeHeader("code.massar")).toBe("code massar");
    expect(normalizeHeader("code-massar")).toBe("code massar");
    expect(normalizeHeader("Lieu (naissance)")).toBe("lieu naissance");
    expect(normalizeHeader("E-Mail")).toBe("e mail");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(normalizeHeader("  Code   Massar  ")).toBe("code massar");
    expect(normalizeHeader("Nom\t\tArabe")).toBe("nom arabe");
    expect(normalizeHeader("code___massar")).toBe("code massar");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeHeader("")).toBe("");
    expect(normalizeHeader("   ")).toBe("");
    expect(normalizeHeader("__")).toBe("");
  });

  it("passes plain Arabic headers through unchanged", () => {
    expect(normalizeHeader("رمز مسار")).toBe("رمز مسار");
    expect(normalizeHeader("النسب")).toBe("النسب");
    expect(normalizeHeader("الاسم")).toBe("الاسم");
    expect(normalizeHeader("تاريخ الازدياد")).toBe("تاريخ الازدياد");
  });

  it("still trims and collapses around Arabic", () => {
    expect(normalizeHeader("  رمز   مسار ")).toBe("رمز مسار");
  });

  // Regression: NFD decomposes أ/إ into alef + a combining hamza. If the mark
  // is not stripped the result matches neither the precomposed nor the bare
  // alias, and Arabic guardian/gender values silently stop resolving.
  it("folds Arabic hamza carriers onto bare alef, leaving no combining marks", () => {
    const folded = normalizeHeader("ولي الأمر");
    expect(folded).toBe(normalizeHeader("ولي الامر"));
    expect(/[̀-ًͯ-ٰٕ]/.test(folded)).toBe(false);
    expect(normalizeHeader("البريد الإلكتروني")).toBe(normalizeHeader("البريد الالكتروني"));
    expect(normalizeHeader("أنثى")).toBe(normalizeHeader("انثى"));
  });

  it("is idempotent", () => {
    for (const h of ["Prénom", "code_massar", "ولي الأمر", "  NOM  "]) {
      expect(normalizeHeader(normalizeHeader(h))).toBe(normalizeHeader(h));
    }
  });
});

describe("guessMapping", () => {
  /** No import field may be claimed by two different columns. */
  function expectNoDoubleClaim(mapping: Record<number, ImportField | "">) {
    const claimed = Object.values(mapping).filter((f): f is ImportField => f !== "");
    expect(claimed).toHaveLength(new Set(claimed).size);
  }

  it("maps French headers", () => {
    const m = guessMapping(["Code Massar", "Nom", "Prénom", "Date de naissance", "Sexe"]);
    expect(m).toEqual({
      0: "codeMassar",
      1: "lastNameFr",
      2: "firstNameFr",
      3: "birthDate",
      4: "gender",
    });
  });

  it("maps Arabic headers", () => {
    const m = guessMapping(["رمز مسار", "النسب", "الاسم", "تاريخ الازدياد"]);
    expect(m).toEqual({
      0: "codeMassar",
      1: "lastNameAr",
      2: "firstNameAr",
      3: "birthDate",
    });
  });

  it("maps Arabic guardian headers carrying a hamza", () => {
    const m = guessMapping(["ولي الأمر", "البريد الإلكتروني", "الهاتف"]);
    expect(m).toEqual({
      0: "guardianName",
      1: "guardianEmail",
      2: "guardianPhone",
    });
  });

  it("maps a mixed French/Arabic sheet", () => {
    const m = guessMapping(["Code Massar", "النسب", "الاسم", "Nom", "Prénom", "Sexe"]);
    expect(m).toEqual({
      0: "codeMassar",
      1: "lastNameAr",
      2: "firstNameAr",
      3: "lastNameFr",
      4: "firstNameFr",
      5: "gender",
    });
    expectNoDoubleClaim(m);
  });

  it("maps unknown headers to an empty string", () => {
    const m = guessMapping(["Observations", "Moyenne", "N°"]);
    expect(m).toEqual({ 0: "", 1: "", 2: "" });
  });

  it("maps a blank header to an empty string", () => {
    const m = guessMapping(["Nom", "", "   "]);
    expect(m[0]).toBe("lastNameFr");
    expect(m[1]).toBe("");
    expect(m[2]).toBe("");
  });

  it("does not let \"Nom\" swallow \"Nom arabe\"", () => {
    const m = guessMapping(["Nom", "Nom arabe"]);
    expect(m[0]).toBe("lastNameFr");
    expect(m[1]).toBe("lastNameAr");
    expect(m[0]).not.toBe(m[1]);
    expectNoDoubleClaim(m);
  });

  it("does not let \"Prénom\" swallow \"Prénom arabe\"", () => {
    const m = guessMapping(["Prénom", "Prénom arabe"]);
    expect(m[0]).toBe("firstNameFr");
    expect(m[1]).toBe("firstNameAr");
    expect(m[0]).not.toBe(m[1]);
    expectNoDoubleClaim(m);
  });

  it("keeps the four name columns distinct whatever their order", () => {
    const m = guessMapping(["Nom arabe", "Prénom arabe", "Nom", "Prénom"]);
    expect(m).toEqual({
      0: "lastNameAr",
      1: "firstNameAr",
      2: "lastNameFr",
      3: "firstNameFr",
    });
    expectNoDoubleClaim(m);
  });

  it("never claims a field twice on a duplicated header", () => {
    const m = guessMapping(["Nom", "Nom", "Prénom"]);
    expect(m[0]).toBe("lastNameFr");
    expect(m[1]).not.toBe("lastNameFr");
    expectNoDoubleClaim(m);
  });

  it("distinguishes the two birth-place columns", () => {
    const m = guessMapping(["Lieu de naissance", "Lieu de naissance AR"]);
    expect(m[0]).toBe("birthPlaceFr");
    expect(m[1]).toBe("birthPlaceAr");
    expectNoDoubleClaim(m);
  });

  it("is insensitive to case, accents and separators", () => {
    expect(guessMapping(["CODE_MASSAR"])[0]).toBe("codeMassar");
    expect(guessMapping(["  date de naissance  "])[0]).toBe("birthDate");
    expect(guessMapping(["DATE DE NAISSANCE"])[0]).toBe("birthDate");
  });

  it("maps every column of a realistic full export", () => {
    const headers = [
      "Code Massar",
      "النسب",
      "الاسم",
      "Nom",
      "Prénom",
      "Date de naissance",
      "Lieu de naissance",
      "Sexe",
      "CNE",
      "Nom du tuteur",
      "Téléphone",
      "Email",
      "Observations",
    ];
    const m = guessMapping(headers);
    expect(m).toEqual({
      0: "codeMassar",
      1: "lastNameAr",
      2: "firstNameAr",
      3: "lastNameFr",
      4: "firstNameFr",
      5: "birthDate",
      6: "birthPlaceFr",
      7: "gender",
      8: "cne",
      9: "guardianName",
      10: "guardianPhone",
      11: "guardianEmail",
      12: "",
    });
    expectNoDoubleClaim(m);
  });

  it("returns an entry for every header, and only known fields", () => {
    const headers = ["Code Massar", "Zzz", "Nom"];
    const m = guessMapping(headers);
    expect(Object.keys(m)).toHaveLength(headers.length);
    for (const value of Object.values(m)) {
      if (value !== "") expect(IMPORT_FIELDS).toContain(value);
    }
  });

  it("handles an empty header list", () => {
    expect(guessMapping([])).toEqual({});
  });
});

describe("parseBirthDate", () => {
  it("parses an ISO date", () => {
    expect(iso(parseBirthDate("2008-04-15"))).toBe("2008-04-15");
  });

  it("parses a day-first slash date as day/month, not month/day", () => {
    const d = parseBirthDate("15/04/2008");
    expect(iso(d)).toBe("2008-04-15");
    // Guard against a 4 November misread.
    expect(d?.getUTCDate()).toBe(15);
    expect(d?.getUTCMonth()).toBe(3); // April
  });

  it("parses a day-first dash date as day/month, not month/day", () => {
    const d = parseBirthDate("15-04-2008");
    expect(iso(d)).toBe("2008-04-15");
    expect(d?.getUTCDate()).toBe(15);
    expect(d?.getUTCMonth()).toBe(3);
  });

  it("parses an ambiguous day-first date the Moroccan way", () => {
    // 04/05/2008 is 4 May, never 5 April.
    const d = parseBirthDate("04/05/2008");
    expect(iso(d)).toBe("2008-05-04");
  });

  it("accepts unpadded day and month", () => {
    expect(iso(parseBirthDate("5/4/2008"))).toBe("2008-04-05");
    expect(iso(parseBirthDate("2008-4-5"))).toBe("2008-04-05");
  });

  it("parses an Excel serial number", () => {
    expect(iso(parseBirthDate("39553"))).toBe("2008-04-15");
  });

  it("trims surrounding whitespace", () => {
    expect(iso(parseBirthDate("  2008-04-15  "))).toBe("2008-04-15");
    expect(iso(parseBirthDate(" 15/04/2008 "))).toBe("2008-04-15");
  });

  it("handles a leap day", () => {
    expect(iso(parseBirthDate("29/02/2008"))).toBe("2008-02-29");
  });

  it("returns null for an impossible date", () => {
    expect(parseBirthDate("32/13/2008")).toBeNull();
  });

  it("returns null for an out-of-range month", () => {
    expect(parseBirthDate("15/13/2008")).toBeNull();
    expect(parseBirthDate("2008-13-15")).toBeNull();
  });

  it("returns null for an out-of-range day", () => {
    expect(parseBirthDate("32/01/2008")).toBeNull();
    expect(parseBirthDate("00/01/2008")).toBeNull();
  });

  it("returns null for a day that overflows its month", () => {
    expect(parseBirthDate("31/04/2008")).toBeNull(); // April has 30 days
    expect(parseBirthDate("30/02/2008")).toBeNull(); // February never has 30
    expect(parseBirthDate("29/02/2007")).toBeNull(); // 2007 is not a leap year
  });

  it("returns null for an empty string", () => {
    expect(parseBirthDate("")).toBeNull();
    expect(parseBirthDate("   ")).toBeNull();
  });

  it("returns null for garbage", () => {
    expect(parseBirthDate("not a date")).toBeNull();
    expect(parseBirthDate("??")).toBeNull();
    expect(parseBirthDate("15/04")).toBeNull();
  });
});

describe("parseGender", () => {
  it("parses the single-letter French codes", () => {
    expect(parseGender("M")).toBe("M");
    expect(parseGender("F")).toBe("F");
  });

  it("is case-insensitive", () => {
    expect(parseGender("m")).toBe("M");
    expect(parseGender("f")).toBe("F");
  });

  it("parses the spelled-out French words", () => {
    expect(parseGender("Masculin")).toBe("M");
    expect(parseGender("Féminin")).toBe("F");
    expect(parseGender("MASCULIN")).toBe("M");
    expect(parseGender("feminin")).toBe("F");
  });

  it("parses the English words", () => {
    expect(parseGender("Male")).toBe("M");
    expect(parseGender("Female")).toBe("F");
  });

  it("parses the Arabic words", () => {
    expect(parseGender("ذكر")).toBe("M");
    expect(parseGender("أنثى")).toBe("F");
    expect(parseGender("انثى")).toBe("F");
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseGender("  M  ")).toBe("M");
    expect(parseGender(" ذكر ")).toBe("M");
    expect(parseGender(" أنثى ")).toBe("F");
  });

  it("returns null for an unknown value", () => {
    expect(parseGender("X")).toBeNull();
    expect(parseGender("autre")).toBeNull();
    expect(parseGender("1")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseGender("")).toBeNull();
    expect(parseGender("   ")).toBeNull();
  });
});

describe("validateRows", () => {
  const MAPPING = mappingOf(["codeMassar", "lastNameFr", "firstNameFr", "birthDate"]);

  function sheet(rows: string[][]): SheetData {
    return { headers: ["Code Massar", "Nom", "Prénom", "Date de naissance"], rows };
  }

  it("reports no error for a fully valid row", () => {
    const [row] = validateRows(sheet([["A123456789", "Alaoui", "Yassine", "15/04/2008"]]), MAPPING);
    expect(row.errors).toEqual([]);
    expect(row.index).toBe(1);
    expect(row.values.codeMassar).toBe("A123456789");
    expect(row.values.lastNameFr).toBe("Alaoui");
    expect(iso(row.birthDate)).toBe("2008-04-15");
  });

  it("numbers rows 1-based", () => {
    const rows = validateRows(
      sheet([
        ["A123456789", "Alaoui", "Yassine", "15/04/2008"],
        ["B123456789", "Bennani", "Salma", "16/04/2008"],
      ]),
      MAPPING,
    );
    expect(rows.map((r) => r.index)).toEqual([1, 2]);
  });

  it("reports a missing required field", () => {
    const [row] = validateRows(sheet([["A123456789", "", "Yassine", "15/04/2008"]]), MAPPING);
    expect(row.errors).toContain("missing.lastName");
    expect(row.errors).not.toContain("missing.firstName");
  });

  it("reports every missing required field on an empty row", () => {
    const [row] = validateRows(sheet([["", "", "", ""]]), MAPPING);
    expect(row.errors).toEqual([
      "missing.codeMassar",
      "missing.birthDate",
      "missing.lastName",
      "missing.firstName",
    ]);
    // Names are not in REQUIRED_FIELDS: they are required in either script, not
    // in a specific one.
    expect(REQUIRED_FIELDS).toEqual(["codeMassar", "birthDate"]);
  });

  it("accepts an Arabic-only export, which has no French name columns at all", () => {
    // This is what a real Massar export looks like, and it must not be rejected.
    const arabicSheet = {
      headers: ["رمز مسار", "النسب", "الاسم", "تاريخ الازدياد"],
      rows: [["A123456789", "العلوي", "مريم", "15/04/2008"]],
    };
    const [row] = validateRows(arabicSheet, guessMapping(arabicSheet.headers));
    expect(row.errors).toEqual([]);
    expect(row.values.lastNameAr).toBe("العلوي");
    expect(row.values.lastNameFr).toBeUndefined();
  });

  it("treats a short row as missing its trailing fields", () => {
    const [row] = validateRows(sheet([["A123456789"]]), MAPPING);
    expect(row.errors).toContain("missing.lastName");
    expect(row.errors).toContain("missing.firstName");
    expect(row.errors).toContain("missing.birthDate");
    expect(row.errors).not.toContain("missing.codeMassar");
  });

  it("reports an invalid Code Massar", () => {
    const [row] = validateRows(sheet([["XYZ", "Alaoui", "Yassine", "15/04/2008"]]), MAPPING);
    expect(row.errors).toContain("invalid.codeMassar");
    expect(row.errors).not.toContain("missing.codeMassar");
  });

  it("normalizes the Code Massar it keeps", () => {
    const [row] = validateRows(
      sheet([[" a123456789 ", "Alaoui", "Yassine", "15/04/2008"]]),
      MAPPING,
    );
    expect(row.errors).toEqual([]);
    expect(row.values.codeMassar).toBe("A123456789");
  });

  it("flags a duplicate code on the second occurrence only", () => {
    const rows = validateRows(
      sheet([
        ["A123456789", "Alaoui", "Yassine", "15/04/2008"],
        ["B123456789", "Bennani", "Salma", "16/04/2008"],
        ["A123456789", "Cherkaoui", "Omar", "17/04/2008"],
      ]),
      MAPPING,
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toEqual([]);
    expect(rows[2].errors).toContain("duplicate.inFile");
  });

  it("detects a duplicate across different spellings of the same code", () => {
    const rows = validateRows(
      sheet([
        ["A123456789", "Alaoui", "Yassine", "15/04/2008"],
        [" a123456789 ", "Cherkaoui", "Omar", "17/04/2008"],
      ]),
      MAPPING,
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toContain("duplicate.inFile");
  });

  it("does not report a duplicate for an invalid code", () => {
    const rows = validateRows(
      sheet([
        ["XYZ", "Alaoui", "Yassine", "15/04/2008"],
        ["XYZ", "Bennani", "Salma", "16/04/2008"],
      ]),
      MAPPING,
    );
    expect(rows[1].errors).toContain("invalid.codeMassar");
    expect(rows[1].errors).not.toContain("duplicate.inFile");
  });

  it("reports an invalid birth date", () => {
    const [row] = validateRows(
      sheet([["A123456789", "Alaoui", "Yassine", "32/13/2008"]]),
      MAPPING,
    );
    expect(row.errors).toContain("invalid.birthDate");
    expect(row.birthDate).toBeNull();
  });

  it("does not report both missing and invalid for a blank birth date", () => {
    const [row] = validateRows(sheet([["A123456789", "Alaoui", "Yassine", ""]]), MAPPING);
    expect(row.errors).toContain("missing.birthDate");
    expect(row.errors).not.toContain("invalid.birthDate");
  });

  it("reports an invalid guardian email", () => {
    const mapping = mappingOf([
      "codeMassar",
      "lastNameFr",
      "firstNameFr",
      "birthDate",
      "guardianEmail",
    ]);
    const rows = validateRows(
      {
        headers: ["Code Massar", "Nom", "Prénom", "Date de naissance", "Email"],
        rows: [
          ["A123456789", "Alaoui", "Yassine", "15/04/2008", "parent@example.com"],
          ["B123456789", "Bennani", "Salma", "16/04/2008", "not-an-email"],
          ["C123456789", "Cherkaoui", "Omar", "17/04/2008", "a@b"],
          ["D123456789", "Doukkali", "Nada", "18/04/2008", "a b@c.com"],
        ],
      },
      mapping,
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toContain("invalid.guardianEmail");
    expect(rows[2].errors).toContain("invalid.guardianEmail");
    expect(rows[3].errors).toContain("invalid.guardianEmail");
  });

  it("parses the gender column and reports an invalid one", () => {
    const mapping = mappingOf([
      "codeMassar",
      "lastNameFr",
      "firstNameFr",
      "birthDate",
      "gender",
    ]);
    const rows = validateRows(
      {
        headers: ["Code Massar", "Nom", "Prénom", "Date de naissance", "Sexe"],
        rows: [
          ["A123456789", "Alaoui", "Yassine", "15/04/2008", "M"],
          ["B123456789", "Bennani", "Salma", "16/04/2008", "أنثى"],
          ["C123456789", "Cherkaoui", "Omar", "17/04/2008", "?"],
        ],
      },
      mapping,
    );
    expect(rows[0].gender).toBe("M");
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].gender).toBe("F");
    expect(rows[1].errors).toEqual([]);
    expect(rows[2].gender).toBeNull();
    expect(rows[2].errors).toContain("invalid.gender");
  });

  it("ignores unmapped columns", () => {
    const mapping = mappingOf(["codeMassar", "lastNameFr", "firstNameFr", "birthDate", ""]);
    const [row] = validateRows(
      {
        headers: ["Code Massar", "Nom", "Prénom", "Date de naissance", "Observations"],
        rows: [["A123456789", "Alaoui", "Yassine", "15/04/2008", "redoublant"]],
      },
      mapping,
    );
    expect(row.errors).toEqual([]);
    expect(Object.values(row.values)).not.toContain("redoublant");
    expect(Object.keys(row.values).sort()).toEqual(
      ["birthDate", "codeMassar", "firstNameFr", "lastNameFr"].sort(),
    );
  });

  it("accumulates several errors on one row", () => {
    const [row] = validateRows(sheet([["XYZ", "", "Yassine", "garbage"]]), MAPPING);
    expect(row.errors).toContain("missing.lastName");
    expect(row.errors).toContain("invalid.codeMassar");
    expect(row.errors).toContain("invalid.birthDate");
  });

  it("returns an empty array for a sheet with no rows", () => {
    expect(validateRows(sheet([]), MAPPING)).toEqual([]);
  });

  it("returns nothing but missing errors when the mapping is empty", () => {
    const [row] = validateRows(sheet([["A123456789", "Alaoui", "Yassine", "15/04/2008"]]), {});
    expect(row.values).toEqual({});
    expect(row.errors).toEqual([
      "missing.codeMassar",
      "missing.birthDate",
      "missing.lastName",
      "missing.firstName",
    ]);
  });
});
