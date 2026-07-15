import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/dal";
import { getSchoolSettings, schoolName as localizedSchool } from "@/lib/school";
import { currentYear } from "@/lib/data/structure";
import { studentResult, semesterById } from "@/lib/data/grades";
import { renderBulletinPdf, type BulletinSubject } from "@/lib/pdf/bulletin";

/**
 * A student's bulletin, per semester, as a bilingual (AR/FR) PDF.
 *
 * Route Handler = its own entry point, so authorization is re-derived here:
 * the director always; a teacher who teaches the student's class; the student
 * themselves or their parent — the latter two only once the semester's grades
 * are published.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "fr";
  const studentId = url.searchParams.get("student") ?? "";
  const semesterId = url.searchParams.get("semester") ?? "";
  if (!studentId || !semesterId) return new Response(null, { status: 400 });

  const semester = await semesterById(semesterId);
  if (!semester) return new Response(null, { status: 404 });

  // The student's active class — the bulletin is scoped to it.
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, isActive: true },
    select: { classId: true, class: { select: { name: true } } },
  });
  if (!enrollment) return new Response(null, { status: 404 });
  const classId = enrollment.classId;

  // --- authorization ------------------------------------------------------
  const published = Boolean(semester.gradesPublishedAt);
  let allowed = false;
  if (user.role === "DIRECTOR") {
    allowed = true;
  } else if (user.role === "TEACHER") {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    allowed = Boolean(
      profile &&
        (await prisma.teacherAssignment.findFirst({
          where: { teacherId: profile.id, classId },
          select: { id: true },
        })),
    );
  } else if (user.role === "STUDENT" && published) {
    const me = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    allowed = me?.id === studentId;
  } else if (user.role === "PARENT" && published) {
    allowed = Boolean(
      await prisma.studentGuardian.findFirst({
        where: { studentId, guardian: { userId: user.id } },
        select: { studentId: true },
      }),
    );
  }
  if (!allowed) return new Response(null, { status: 403 });

  // --- assemble ----------------------------------------------------------
  const [{ result, stats, classSize }, appreciations, settings, year, t] =
    await Promise.all([
      studentResult(classId, studentId, semesterId),
      prisma.subjectAppreciation.findMany({
        where: { studentId, semesterId },
        select: { subjectId: true, text: true },
      }),
      getSchoolSettings(),
      currentYear(),
      getTranslations({ locale, namespace: "grades" }),
    ]);
  if (!result) return new Response(null, { status: 404 });

  const apprMap = new Map(appreciations.map((a) => [a.subjectId, a.text]));
  const subjects: BulletinSubject[] = result.subjects.map((s) => ({
    name: locale === "ar" ? s.nameAr : s.nameFr,
    coefficient: s.coefficient,
    average: s.average,
    appreciation: apprMap.get(s.subjectId) ?? null,
  }));

  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      user: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true } },
    },
  });
  const name =
    locale === "ar"
      ? `${student?.user.firstNameAr} ${student?.user.lastNameAr}`
      : `${student?.user.firstNameFr} ${student?.user.lastNameFr}`;

  const pdf = await renderBulletinPdf({
    locale,
    schoolName: localizedSchool(settings, locale),
    student: { name, codeMassar: result.codeMassar },
    className: enrollment.class.name,
    yearLabel: year?.label ?? "",
    semesterLabel: t("semesterN", { n: semester.index }),
    subjects,
    general: result.general,
    mention: result.mention ? t(`mentions.${result.mention}`) : "",
    rank: result.rank,
    classSize,
    stats: { average: stats.average, min: stats.min, max: stats.max },
    labels: {
      bulletin: t("bulletin"),
      subject: t("selectSubject"),
      coefficient: t("coefficient"),
      average: t("average"),
      appreciation: t("appreciation"),
      generalAverage: t("generalAverage"),
      rank: t("rank"),
      mention: t("mention"),
      classAverage: t("classAverage"),
      min: t("min"),
      max: t("max"),
      notGraded: t("notGraded"),
      of: t("of"),
    },
  });

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bulletin-${result.codeMassar}-s${semester.index}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
