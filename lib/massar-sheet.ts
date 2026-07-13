import "server-only";

import ExcelJS from "exceljs";
import type { SheetData } from "@/lib/massar";

/**
 * Sheet reading lives apart from lib/massar.ts on purpose.
 *
 * The import wizard is a Client Component and needs validateRows/guessMapping
 * for its live preview. If those sat in the same module as this file, exceljs
 * (a very large dependency) would be pulled into the browser bundle — and the
 * brief requires small bundles for low-end Android phones.
 */
/** Reads the first worksheet of an xlsx/csv buffer into plain strings. */
export async function readSheet(buffer: Buffer, filename: string): Promise<SheetData> {
  const workbook = new ExcelJS.Workbook();

  if (filename.toLowerCase().endsWith(".csv")) {
    const { Readable } = await import("node:stream");
    await workbook.csv.read(Readable.from(buffer.toString("utf8")));
  } else {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headers: string[] = [];
  const rows: string[][] = [];

  sheet.eachRow((row, rowNumber) => {
    const values: string[] = [];
    // exceljs row.values is 1-based with a leading hole
    const raw = row.values as unknown[];
    for (let i = 1; i < raw.length; i++) {
      values.push(cellToString(raw[i]));
    }
    if (rowNumber === 1) headers.push(...values);
    else if (values.some((v) => v !== "")) rows.push(values);
  });

  return { headers, rows };
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const o = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text) return o.text;
    if (o.result !== undefined) return String(o.result);
    return "";
  }
  return String(value).trim();
}
