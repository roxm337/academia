import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StudentGradesView } from "@/components/grades/student-grades-view";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { activeClassOfStudent } from "@/lib/data/timetable";
import { semestersOf } from "@/lib/data/grades";
import { cn } from "@/lib/utils";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/student/grades">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");

  const t = await getTranslations("grades");
  const sp = await searchParams;

  const [me, klass, semesters] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    activeClassOfStudent(user.id),
    semestersOf(),
  ]);

  // Students only ever see published semesters.
  const published = semesters.filter((s) => s.gradesPublishedAt);
  if (!me || !klass || published.length === 0) {
    return (
      <>
        <PageHeader title={t("myGrades")} />
        <EmptyState message={t("notPublishedYet")} />
      </>
    );
  }

  const semesterId = published.some((s) => s.id === sp.semester)
    ? String(sp.semester)
    : published[0].id;

  return (
    <>
      <PageHeader title={t("myGrades")} />
      {published.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {published.map((s) => (
            <a
              key={s.id}
              href={`?semester=${s.id}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                s.id === semesterId
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--border)] hover:bg-black/[0.03]",
              )}
            >
              {t("semesterN", { n: s.index })}
            </a>
          ))}
        </div>
      ) : null}

      <StudentGradesView studentId={me.id} classId={klass.id} semesterId={semesterId} locale={locale} />
    </>
  );
}
