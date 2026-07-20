import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/field";
import { requireRole } from "@/lib/dal";
import { getSchoolSettings } from "@/lib/school";
import { localeTag } from "@/i18n/routing";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({
  params,
}: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireRole("DIRECTOR");
  const t = await getTranslations("settings");
  const settings = await getSchoolSettings();

  if (!settings) return null;

  const dateFmt = new Intl.DateTimeFormat(localeTag(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const year = settings.currentSchoolYear;
  const semesters = [...(year?.semesters ?? [])].sort((a, b) => a.index - b.index);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <SettingsForm settings={settings} />

        <aside className="space-y-5">
          <Card>
            <h2 className="mb-3 font-medium">{t("year")}</h2>
            {year ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">{t("currentYear")}</dt>
                  <dd dir="ltr" className="font-medium">{year.label}</dd>
                </div>
                {semesters.map((s) => (
                  <div key={s.id} className="flex justify-between gap-2">
                    <dt className="text-[var(--muted)]">
                      {t(s.index === 1 ? "semester1" : "semester2")}
                    </dt>
                    <dd className="text-end">
                      {dateFmt.format(s.startDate)} — {dateFmt.format(s.endDate)}
                    </dd>
                  </div>
                ))}
                {year.ramadanStart && year.ramadanEnd ? (
                  <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-2">
                    <dt className="text-[var(--muted)]">{t("ramadan")}</dt>
                    <dd className="text-end">
                      {dateFmt.format(year.ramadanStart)} —{" "}
                      {dateFmt.format(year.ramadanEnd)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </Card>
        </aside>
      </div>
    </>
  );
}
