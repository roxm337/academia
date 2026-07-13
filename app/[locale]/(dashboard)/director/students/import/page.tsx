import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { ImportWizard } from "@/components/director/import-wizard";
import { requireRole } from "@/lib/dal";
import { listClasses } from "@/lib/data/structure";

export default async function ImportPage({
  params,
}: PageProps<"/[locale]/director/students/import">) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireRole("DIRECTOR");
  const t = await getTranslations("director.import");
  const ts = await getTranslations("director.students");

  const classes = await listClasses();

  return (
    <>
      <Link
        href="/director/students"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" />
        {ts("title")}
      </Link>

      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <ImportWizard
        classes={classes.map((c) => ({ id: c.id, label: c.name }))}
      />
    </>
  );
}
