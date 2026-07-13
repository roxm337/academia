/**
 * Massar interop.
 *
 * Massar exports are not consistent between schools or years: column order,
 * header spelling and language all move around, and headers are frequently in
 * Arabic. So we never bind to a fixed layout — we read the header row, guess a
 * mapping, and let the director correct it before anything is written.
 */

/** Code Massar: one letter followed by 9 digits, e.g. A123456789. */
export const CODE_MASSAR_RE = /^[A-Z]\d{9}$/;

export function normalizeCodeMassar(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidCodeMassar(raw: string): boolean {
  return CODE_MASSAR_RE.test(normalizeCodeMassar(raw));
}

/** The fields the importer can fill. */
export const IMPORT_FIELDS = [
  "codeMassar",
  "lastNameAr",
  "firstNameAr",
  "lastNameFr",
  "firstNameFr",
  "birthDate",
  "birthPlaceAr",
  "birthPlaceFr",
  "gender",
  "cne",
  "guardianName",
  "guardianPhone",
  "guardianEmail",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/**
 * Fields that must be present outright.
 *
 * Names are deliberately NOT here. A genuine Arabic Massar export carries only
 * النسب / الاسم and no French name columns at all — requiring lastNameFr would
 * reject every row of a perfectly valid file. Names are instead required in at
 * least ONE script (see validateRows), and the importer mirrors the missing
 * script from the one that is present.
 */
export const REQUIRED_FIELDS: ImportField[] = ["codeMassar", "birthDate"];

/**
 * Header aliases seen in real Massar / school exports, Arabic and French.
 * Matching is accent- and case-insensitive on the normalized header.
 */
const ALIASES: Record<ImportField, string[]> = {
  codeMassar: ["code massar", "massar", "codemassar", "رمز مسار", "رمز التلميذ", "code eleve"],
  lastNameAr: ["nom ar", "nom arabe", "النسب", "الاسم العائلي", "اللقب"],
  firstNameAr: ["prenom ar", "prenom arabe", "الاسم", "الاسم الشخصي"],
  lastNameFr: ["nom", "nom fr", "nom francais", "nom de famille", "النسب بالفرنسية"],
  firstNameFr: ["prenom", "prenom fr", "prenom francais", "الاسم بالفرنسية"],
  birthDate: ["date de naissance", "naissance", "date naissance", "تاريخ الازدياد", "تاريخ الميلاد"],
  birthPlaceAr: ["lieu de naissance ar", "مكان الازدياد", "مكان الميلاد"],
  birthPlaceFr: ["lieu de naissance", "lieu naissance"],
  gender: ["sexe", "genre", "الجنس", "النوع"],
  cne: ["cne", "cin", "الرقم الوطني"],
  guardianName: ["tuteur", "parent", "nom du tuteur", "ولي الأمر", "اسم ولي الأمر"],
  guardianPhone: ["telephone", "tel", "gsm", "phone", "الهاتف", "رقم الهاتف"],
  guardianEmail: ["email", "e-mail", "mail", "البريد الإلكتروني"],
};

/**
 * Lowercase, strip accents/punctuation, collapse spaces.
 *
 * NFD splits accented letters into base + combining mark, which we then drop.
 * The mark ranges must cover Arabic as well as Latin: NFD turns أ/إ/آ into
 * bare alef + a combining hamza/madda (U+0653-U+0655), and if those are left
 * behind the result no longer equals the (precomposed) aliases below.
 */
export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064b-\u0655\u0670]/g, "")
    .toLowerCase()
    .replace(/[._\-()/\\:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Aliases put through normalizeHeader, so both sides of a compare match. */
const NORMALIZED_ALIASES = Object.fromEntries(
  IMPORT_FIELDS.map((field) => [field, ALIASES[field].map(normalizeHeader)]),
) as Record<ImportField, string[]>;

/** Best-guess mapping from sheet headers to import fields. */
export function guessMapping(headers: string[]): Record<number, ImportField | ""> {
  const mapping: Record<number, ImportField | ""> = {};
  const taken = new Set<ImportField>();

  headers.forEach((header, index) => {
    const norm = normalizeHeader(header);
    if (!norm) {
      mapping[index] = "";
      return;
    }

    let match: ImportField | "" = "";
    // exact alias first, then prefix — "nom" must not swallow "nom arabe"
    for (const field of IMPORT_FIELDS) {
      if (taken.has(field)) continue;
      if (NORMALIZED_ALIASES[field].some((a) => a === norm)) {
        match = field;
        break;
      }
    }
    // Decisive-token pass. A header that mentions an email or a phone IS that
    // column, whoever it belongs to. Without this, "Email du tuteur" matches
    // both "email" (guardianEmail) and "tuteur" (guardianName), and plain field
    // order or alias length would hand it to guardianName — silently importing
    // an address into the name column.
    if (!match) {
      const has = (token: string) =>
        new RegExp(`(^|\\s)${token}($|\\s)`).test(norm) || norm.includes(token);

      if (["email", "e mail", "mail"].some(has)) match = "guardianEmail";
      else if (["telephone", "tel", "gsm", "phone", "هاتف"].some(has))
        match = "guardianPhone";

      if (match && taken.has(match)) match = "";
    }

    // Substring pass, most specific (longest) alias wins.
    if (!match) {
      let bestLength = 0;
      for (const field of IMPORT_FIELDS) {
        if (taken.has(field)) continue;
        for (const alias of NORMALIZED_ALIASES[field]) {
          if (norm.includes(alias) && alias.length > bestLength) {
            bestLength = alias.length;
            match = field;
          }
        }
      }
    }

    if (match) taken.add(match);
    mapping[index] = match;
  });

  return mapping;
}

export type SheetData = {
  headers: string[];
  rows: string[][];
};

/**
 * Parses the many date shapes a Moroccan school file can contain:
 * 2008-04-15, 15/04/2008, 15-04-2008, and Excel serial numbers.
 */
export function parseBirthDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  // Excel serial (days since 1899-12-30)
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    const ms = (serial - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return safeDate(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return safeDate(+m[3], +m[2], +m[1]); // day-first, as used in Morocco

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeDate(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1
    ? date
    : null;
}

// Normalized for the same reason as NORMALIZED_ALIASES: "أنثى" loses its
// precomposed hamza once normalizeHeader has run over the incoming value.
const MALE_VALUES = ["m", "masculin", "male", "ذكر", "ذ"].map(normalizeHeader);
const FEMALE_VALUES = ["f", "feminin", "female", "أنثى", "انثى", "ا"].map(normalizeHeader);

export function parseGender(raw: string): "M" | "F" | null {
  const s = normalizeHeader(raw);
  if (!s) return null;
  if (MALE_VALUES.includes(s)) return "M";
  if (FEMALE_VALUES.includes(s)) return "F";
  return null;
}

export type ParsedRow = {
  index: number; // 1-based row number in the sheet body
  values: Partial<Record<ImportField, string>>;
  birthDate: Date | null;
  gender: "M" | "F" | null;
  errors: string[]; // message keys, e.g. "missing.codeMassar"
};

/**
 * Validates rows against the mapping. Pure — no DB access — so it unit-tests
 * cleanly; duplicate-against-database checks happen in the import action.
 */
export function validateRows(
  sheet: SheetData,
  mapping: Record<number, ImportField | "">,
): ParsedRow[] {
  const seenCodes = new Map<string, number>();

  return sheet.rows.map((row, i) => {
    const values: Partial<Record<ImportField, string>> = {};
    for (const [colIndex, field] of Object.entries(mapping)) {
      if (!field) continue;
      const v = row[Number(colIndex)] ?? "";
      if (v !== "") values[field] = v;
    }

    const errors: string[] = [];

    for (const field of REQUIRED_FIELDS) {
      if (!values[field]) errors.push(`missing.${field}`);
    }

    // A name in either script is enough — Arabic-only and French-only exports
    // are both normal. The importer mirrors whichever script is missing.
    if (!values.lastNameAr && !values.lastNameFr) errors.push("missing.lastName");
    if (!values.firstNameAr && !values.firstNameFr) errors.push("missing.firstName");

    if (values.codeMassar) {
      const code = normalizeCodeMassar(values.codeMassar);
      values.codeMassar = code;
      if (!isValidCodeMassar(code)) {
        errors.push("invalid.codeMassar");
      } else if (seenCodes.has(code)) {
        errors.push("duplicate.inFile");
      } else {
        seenCodes.set(code, i);
      }
    }

    const birthDate = values.birthDate ? parseBirthDate(values.birthDate) : null;
    if (values.birthDate && !birthDate) errors.push("invalid.birthDate");

    const gender = values.gender ? parseGender(values.gender) : null;
    if (values.gender && !gender) errors.push("invalid.gender");

    if (values.guardianEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.guardianEmail)) {
      errors.push("invalid.guardianEmail");
    }

    return { index: i + 1, values, birthDate, gender, errors };
  });
}
