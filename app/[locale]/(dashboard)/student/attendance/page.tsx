import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StudentAttendanceView } from "@/components/vie/student-attendance-view";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export default async function Page({
  params,
}: PageProps<"/[locale]/student/attendance">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");

  const t = await getTranslations("vie.attendance");

  const me = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      user: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true } },
    },
  });
  if (!me) {
    return (
      <>
        <PageHeader title={t("myTitle")} />
        <EmptyState message={t("noRecords")} />
      </>
    );
  }

  const name =
    locale === "ar"
      ? `${me.user.firstNameAr} ${me.user.lastNameAr}`
      : `${me.user.firstNameFr} ${me.user.lastNameFr}`;

  return (
    <>
      <PageHeader title={t("myTitle")} />
      <StudentAttendanceView studentId={me.id} studentName={name} locale={locale} canSubmit />
    </>
  );
}
