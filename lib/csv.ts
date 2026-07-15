/**
 * CSV building — pure and client-safe. RFC-4180 quoting so a comma, quote or
 * newline inside a field (a bilingual name, an address) never breaks a column.
 */

export type CsvCell = string | number | null | undefined;

/** Quote a single field if it contains a separator, quote, newline or edge space. */
function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV document (CRLF line endings, per the spec) from headers + rows. */
export function toCSV(headers: CsvCell[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return lines.join("\r\n");
}
