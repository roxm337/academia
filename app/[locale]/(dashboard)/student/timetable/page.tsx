import { getTranslations, setRequestLocale } from "next-intl/server";
import { Printer } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { ReadOnlyTimetable } from "@/components/readonly-timetable";
import { VariantTabs } from "@/components/variant-tabs";
import { requireRole } from "@/lib/dal";
import { activeClassOfStudent, getClassSlots } from "@/lib/data/timetable";
import { currentYear } from "@/lib/data/structure";
import { variantForDate, type TimetableVariant } from "@/lib/timetable";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/student/timetable">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("STUDENT");

  const t = await getTranslations("timetable");
  const sp = await searchParams;

  const klass = await activeClassOfStudent(user.id);
  if (!klass) {
    return (
      <>
        <PageHeader title={t("myTimetable")} />
        <EmptyState message={t("studentNoClass")} />
      </>
    );
  }

  const year = await currentYear();
  const today: TimetableVariant = year
    ? variantForDate(new Date(), year.ramadanStart, year.ramadanEnd)
    : "NORMAL";
  const variant: TimetableVariant =
    sp.variant === "RAMADAN" ? "RAMADAN" : sp.variant === "NORMAL" ? "NORMAL" : today;

  const slots = await getClassSlots(klass.id, variant);

  return (
    <>
      <PageHeader title={t("myTimetable")} subtitle={t("forClass", { name: klass.name })} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <VariantTabs variant={variant} />
        <a
          href={`/api/timetable/pdf?variant=${variant}&locale=${locale}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-black/[0.03]"
        >
          <Printer className="size-4" />
          {t("print")}
        </a>
      </div>
      <ReadOnlyTimetable
        variant={variant}
        slots={slots}
        locale={locale}
        mode="student"
      />
    </>
  );
}
