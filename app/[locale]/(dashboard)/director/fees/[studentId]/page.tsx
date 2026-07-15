import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Link } from "@/i18n/navigation";
import { StudentFeeView } from "@/components/fees/student-fee-view";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export default async function Page({
  params,
}: PageProps<"/[locale]/director/fees/[studentId]">) {
  const { locale, studentId } = await params;
  setRequestLocale(locale);
  await requireRole("DIRECTOR");

  const t = await getTranslations("fees");
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { codeMassar: true, user: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true } } },
  });
  if (!student) {
    return <EmptyState message={t("noSchedule")} />;
  }
  const name = locale === "ar"
    ? `${student.user.firstNameAr} ${student.user.lastNameAr}`
    : `${student.user.firstNameFr} ${student.user.lastNameFr}`;

  return (
    <>
      <Link href="/director/fees" className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="size-4 rtl:-scale-x-100" />{t("title")}
      </Link>
      <PageHeader title={t("childTitle", { name })} subtitle={student.codeMassar} />
      <StudentFeeView studentId={studentId} locale={locale} manage />
    </>
  );
}
