import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StudentDashboard } from "@/components/student/student-dashboard";
import { requireRole } from "@/lib/dal";
import { studentKpis } from "@/lib/data/dashboard";
import { currentYear } from "@/lib/data/structure";
import { semestersOf, studentResult } from "@/lib/data/grades";
import { studentAttendance } from "@/lib/data/attendance";
import { homeworkForStudent } from "@/lib/data/homework";
import { activeClassOfStudent } from "@/lib/data/timetable";
import { prisma } from "@/lib/prisma";

export default async function Page({ params }: PageProps<"/[locale]/student">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const [profile, klass, year, kpis, semesters] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, codeMassar: true, user: { select: { firstNameFr: true, lastNameFr: true, firstNameAr: true, lastNameAr: true } } },
    }),
    activeClassOfStudent(user.id),
    currentYear(),
    studentKpis(user, locale),
    semestersOf(),
  ]);
  const publishedSemester = semesters.filter((semester) => semester.gradesPublishedAt).sort((a, b) => b.index - a.index)[0];
  const [resultPack, attendance, homework] = await Promise.all([
    publishedSemester && klass && profile ? studentResult(klass.id, profile.id, publishedSemester.id) : null,
    profile && year ? studentAttendance(profile.id, year.startDate, year.endDate) : [],
    profile && klass ? homeworkForStudent(klass.id, profile.id) : [],
  ]);
  const lessonsToday = Number(kpis.find((item) => item.key === "todayLessons")?.value ?? 0);
  const unreadAnnouncements = Number(kpis.find((item) => item.key === "unreadAnnouncements")?.value ?? 0);
  const attendanceRate = attendance.length
    ? Math.round(((attendance.length - attendance.filter((record) => record.status === "ABSENT").length) / attendance.length) * 100)
    : null;

  return <>
    <PageHeader title={t("student")} subtitle={t("welcome", { name: locale === "ar" ? user.nameAr : user.name })} />
    <StudentDashboard data={{
      studentName: locale === "ar" ? `${profile?.user.firstNameAr ?? user.nameAr} ${profile?.user.lastNameAr ?? ""}` : `${profile?.user.firstNameFr ?? user.name} ${profile?.user.lastNameFr ?? ""}`,
      className: klass?.name ?? null,
      codeMassar: profile?.codeMassar ?? tc("notAvailable"),
      schoolYear: year?.label ?? tc("notAvailable"),
      lessonsToday,
      unreadAnnouncements,
      homeworkToSubmit: homework.filter((item) => !item.mySubmission).length,
      attendanceRate,
      result: resultPack?.result ? { ...resultPack.result, classSize: resultPack.classSize } : null,
    }} />
  </>;
}
