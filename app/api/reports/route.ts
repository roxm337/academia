import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/dal";
import { toCSV, type CsvCell } from "@/lib/csv";
import { formatMAD } from "@/lib/fees";
import { computeClassResults } from "@/lib/data/grades";
import { classFeeOverview } from "@/lib/data/fees";
import { absenceSummary } from "@/lib/data/attendance";

/**
 * Director CSV exports: class list, grade summary, fee ledger, attendance stats.
 * Director-only — re-checked here, since a Route Handler stands alone.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });
  if (user.role !== "DIRECTOR") return new Response(null, { status: 403 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "";
  const classId = url.searchParams.get("class") ?? "";
  const semesterId = url.searchParams.get("semester") ?? "";
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "fr";
  if (!classId) return new Response(null, { status: 400 });

  const t = await getTranslations({ locale, namespace: "reports" });
  const klass = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!klass) return new Response(null, { status: 404 });

  const isAr = locale === "ar";
  const fullName = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    isAr ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;

  let headers: CsvCell[] = [];
  let rows: CsvCell[][] = [];

  if (kind === "class-list") {
    const roster = await prisma.enrollment.findMany({
      where: { classId, isActive: true },
      include: {
        student: {
          include: {
            user: true,
            guardians: { include: { guardian: true } },
          },
        },
      },
    });
    headers = [t("codeMassar"), t("name"), t("gender"), t("birthDate"), t("guardianPhone")];
    rows = roster
      .map((e) => e.student)
      .sort((a, b) => a.user.lastNameFr.localeCompare(b.user.lastNameFr))
      .map((s) => [
        s.codeMassar,
        fullName(s.user),
        s.gender ?? "",
        s.birthDate.toISOString().slice(0, 10),
        s.guardians[0]?.guardian.phone ?? "",
      ]);
  } else if (kind === "grades") {
    if (!semesterId) return new Response(null, { status: 400 });
    const { students } = await computeClassResults(classId, semesterId);
    headers = [t("rank"), t("codeMassar"), t("name"), t("general"), t("mention")];
    rows = students.map((s) => [
      s.rank ?? "",
      s.codeMassar,
      fullName(s),
      s.general?.toFixed(2) ?? "",
      s.mention ? t(`mentions.${s.mention}`) : "",
    ]);
  } else if (kind === "fees") {
    const overview = await classFeeOverview(classId);
    headers = [t("codeMassar"), t("name"), t("net"), t("discount"), t("paid"), t("balance")];
    rows = overview.map((o) => [
      o.student.codeMassar,
      fullName(o.student.user),
      o.summary ? formatMAD(o.summary.net, locale) : "",
      o.summary ? formatMAD(o.summary.discount, locale) : "",
      o.summary ? formatMAD(o.summary.paid, locale) : "",
      o.summary ? formatMAD(o.summary.balance, locale) : "",
    ]);
  } else if (kind === "attendance") {
    const roster = await prisma.enrollment.findMany({
      where: { classId, isActive: true },
      select: { student: { select: { id: true, codeMassar: true, user: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true } } } } },
    });
    headers = [t("codeMassar"), t("name"), t("absences"), t("unexcused"), t("lates")];
    rows = await Promise.all(
      roster.map(async (e) => {
        const s = await absenceSummary(e.student.id);
        return [e.student.codeMassar, fullName(e.student.user), s.absent, s.unexcused, s.late] as CsvCell[];
      }),
    );
  } else {
    return new Response(null, { status: 400 });
  }

  // UTF-8 BOM so Excel opens Arabic correctly.
  const body = "﻿" + toCSV(headers, rows);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${klass.name.replace(/\s+/g, "_")}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
