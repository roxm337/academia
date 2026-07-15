import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StudentHomeworkList } from "@/components/pedagogy/student-homework-list";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { activeClassOfStudent } from "@/lib/data/timetable";

export default async function Page({
  params,
}: PageProps<"/[locale]/student/homework">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");

  const t = await getTranslations("homework");
  const [me, klass] = await Promise.all([
    prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    activeClassOfStudent(user.id),
  ]);

  if (!me || !klass) {
    return (
      <>
        <PageHeader title={t("myTitle")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("myTitle")} />
      <StudentHomeworkList classId={klass.id} studentId={me.id} locale={locale} canSubmit />
    </>
  );
}
