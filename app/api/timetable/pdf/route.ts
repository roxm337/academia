import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/dal";
import { currentYear } from "@/lib/data/structure";
import {
  getClassSlots,
  getTeacherSlots,
  teacherProfileOf,
  activeClassOfStudent,
} from "@/lib/data/timetable";
import { renderTimetablePdf, type PdfSlot } from "@/lib/pdf/timetable";
import { resolveLocale } from "@/i18n/routing";
import {
  WEEKDAYS,
} from "@/lib/timetable";

/**
 * Timetable PDF, per class or per teacher.
 *
 * This is a Route Handler — a separate entry point with no protection from
 * proxy.ts or the page that linked here. So it re-derives *what the caller is
 * allowed to see* from their role, never from the `class`/`teacher` params
 * alone: a teacher gets only their own grid, a student only their class, a
 * parent only a class one of their children is in.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const url = new URL(req.url);
  const locale = resolveLocale(url.searchParams.get("locale"));
  const reqClass = url.searchParams.get("class");
  const reqTeacher = url.searchParams.get("teacher");

  const year = await currentYear();

  // Resolve the scope the caller is actually entitled to.
  let scope:
    | { kind: "class"; classId: string }
    | { kind: "teacher"; teacherId: string }
    | null = null;

  switch (user.role) {
    case "DIRECTOR":
    case "SURVEILLANT":
      if (reqClass) scope = { kind: "class", classId: reqClass };
      else if (reqTeacher) scope = { kind: "teacher", teacherId: reqTeacher };
      break;
    case "TEACHER": {
      const profile = await teacherProfileOf(user.id);
      if (profile) scope = { kind: "teacher", teacherId: profile.id };
      break;
    }
    case "STUDENT": {
      const klass = await activeClassOfStudent(user.id);
      if (klass) scope = { kind: "class", classId: klass.id };
      break;
    }
    case "PARENT": {
      if (reqClass) {
        // Only if a child of this parent is actively in that class.
        const enr = await prisma.enrollment.findFirst({
          where: {
            classId: reqClass,
            isActive: true,
            student: { guardians: { some: { guardian: { userId: user.id } } } },
          },
          select: { id: true },
        });
        if (enr) scope = { kind: "class", classId: reqClass };
      }
      break;
    }
  }

  if (!scope) return new Response(null, { status: 403 });

  const t = await getTranslations({ locale, namespace: "timetable" });
  const localized = (r: { nameAr: string; nameFr: string }) =>
    locale === "ar" ? r.nameAr : r.nameFr;
  const personName = (u: {
    firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string;
  }) =>
    locale === "ar"
      ? `${u.firstNameAr} ${u.lastNameAr}`
      : `${u.firstNameFr} ${u.lastNameFr}`;

  let title = "";
  let slots: PdfSlot[] = [];

  if (scope.kind === "class") {
    const [klass, rows] = await Promise.all([
      prisma.class.findUnique({
        where: { id: scope.classId },
        select: { name: true },
      }),
      getClassSlots(scope.classId),
    ]);
    if (!klass) return new Response(null, { status: 404 });
    title = t("forClass", { name: klass.name });
    slots = rows.map((s) => ({
      weekday: s.weekday,
      startMin: s.startMin,
      endMin: s.endMin,
      subject: localized(s.subject),
      secondary: personName(s.teacher.user),
      room: s.room?.name ?? null,
    }));
  } else {
    const [teacher, rows] = await Promise.all([
      prisma.teacherProfile.findUnique({
        where: { id: scope.teacherId },
        select: { user: true },
      }),
      getTeacherSlots(scope.teacherId),
    ]);
    if (!teacher) return new Response(null, { status: 404 });
    title = t("forTeacher", { name: personName(teacher.user) });
    slots = rows.map((s) => ({
      weekday: s.weekday,
      startMin: s.startMin,
      endMin: s.endMin,
      subject: localized(s.subject),
      secondary: s.class.name,
      room: s.room?.name ?? null,
    }));
  }

  const weekdayLabels: Record<string, string> = {};
  for (const d of WEEKDAYS) weekdayLabels[d] = t(`weekdays.${d}`);

  const subtitle = t("schoolYear", { year: year?.label ?? "" });

  const pdf = await renderTimetablePdf({
    title,
    subtitle,
    locale,
    timeLabel: t("time"),
    weekdayLabels,
    slots,
  });

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
    },
  });
}
