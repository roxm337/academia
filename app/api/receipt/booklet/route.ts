import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/dal";
import { buildReceiptInputs, receiptIdsFor } from "@/lib/data/receipt";
import { renderReceiptBooklet } from "@/lib/pdf/receipt";
import { resolveLocale } from "@/i18n/routing";

/**
 * Receipts issued in a date range, as one PDF — optionally narrowed to a class.
 *
 * Director-only: a batch spans many families, so unlike a single receipt there
 * is no version of this a parent may fetch.
 *
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD[&class=<id>][&locale=ar|en|fr]`
 */
export async function GET(req: NextRequest) {
  // requireRole redirects a signed-in non-director and throws for anonymous;
  // both are handled by the framework, so nothing leaks from here.
  await requireRole("DIRECTOR");

  const url = new URL(req.url);
  const locale = resolveLocale(url.searchParams.get("locale"));
  const fromRaw = url.searchParams.get("from") ?? "";
  const toRaw = url.searchParams.get("to") ?? "";

  const from = new Date(`${fromRaw}T00:00:00`);
  const to = new Date(`${toRaw}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return new Response(null, { status: 400 });
  }
  if (from > to) return new Response(null, { status: 400 });

  const classId = url.searchParams.get("class") || undefined;
  const ids = await receiptIdsFor({ from, to, classId });
  if (ids.length === 0) return new Response(null, { status: 404 });

  const inputs = await buildReceiptInputs({ receiptIds: ids, locale });
  const pdf = await renderReceiptBooklet(inputs);

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recus-${fromRaw}-${toRaw}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
