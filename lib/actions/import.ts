"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import {
  guessMapping,
  type ImportField,
  type SheetData,
} from "@/lib/massar";
import { importStudents } from "@/lib/data/import-students";
import { readSheet } from "@/lib/massar-sheet";
import { MAX_UPLOAD_BYTES } from "@/lib/storage";

export type ParseState =
  | { ok: true; sheet: SheetData; mapping: Record<number, ImportField | ""> }
  | { ok: false; error: string }
  | null;

const SHEET_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];

/**
 * Step 1 — read the file and guess the column mapping.
 *
 * Nothing is written here. The sheet is handed back to the browser so the
 * director can fix the mapping and see exactly what will be imported before a
 * single row lands in the database.
 */
export async function parseImportFile(
  _prev: ParseState,
  formData: FormData,
): Promise<ParseState> {
  await requireRole("DIRECTOR");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "empty" };
  }
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooLarge" };

  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
  if (!isCsv && !isXlsx && !SHEET_TYPES.includes(file.type)) {
    return { ok: false, error: "badType" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sheet = await readSheet(buffer, file.name);
    if (sheet.rows.length === 0) return { ok: false, error: "empty" };

    return { ok: true, sheet, mapping: guessMapping(sheet.headers) };
  } catch {
    return { ok: false, error: "badType" };
  }
}

export type ImportResult = {
  ok?: boolean;
  error?: string;
  imported?: number;
  skipped?: number;
} | null;

/**
 * Step 2 — import the valid rows.
 *
 * Re-validates from scratch: the mapping and rows arrive from the client, so
 * nothing that came back from the browser is trusted. Rows that fail (bad Code
 * Massar, duplicate, already in the database) are skipped and counted rather
 * than aborting the whole file — a director importing 200 students should not
 * lose 199 good rows to one bad one.
 */
export async function runImport(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const actor = await requireRole("DIRECTOR");

  let sheet: SheetData;
  let mapping: Record<number, ImportField | "">;
  try {
    sheet = JSON.parse(String(formData.get("sheet") ?? "")) as SheetData;
    mapping = JSON.parse(String(formData.get("mapping") ?? "")) as Record<
      number,
      ImportField | ""
    >;
  } catch {
    return { error: "invalid" };
  }
  if (!sheet?.rows?.length) return { error: "empty" };

  const classId = String(formData.get("classId") ?? "") || null;

  const outcome = await importStudents({
    sheet,
    mapping,
    classId,
    actorId: actor.id,
  });

  if (outcome.imported === 0 && outcome.invalidRows === sheet.rows.length) {
    return { error: "noValidRows" };
  }

  await audit({
    actorId: actor.id,
    action: "STUDENT_IMPORT",
    entity: "StudentProfile",
    after: { rows: sheet.rows.length, ...outcome, classId },
  });

  revalidatePath("/[locale]/(dashboard)/director/students", "page");

  return { ok: true, imported: outcome.imported, skipped: outcome.skipped };
}
