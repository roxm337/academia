import { getTranslations, setRequestLocale } from "next-intl/server";
import { Download } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/field";
import { ClassSemesterPicker } from "@/components/grades/class-semester-picker";
import { requireRole } from "@/lib/dal";
import { listClassesLite } from "@/lib/data/timetable";
import { semestersOf } from "@/lib/data/grades";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/director/reports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("DIRECTOR");

  const t = await getTranslations("reports");
  const sp = await searchParams;
  const [classes, semesters] = await Promise.all([listClassesLite(), semestersOf()]);

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  const classId = classes.some((c) => c.id === sp.class) ? String(sp.class) : classes[0].id;
  const semesterId = semesters.some((s) => s.id === sp.semester) ? String(sp.semester) : (semesters[0]?.id ?? "");
  const sem = semesters.find((s) => s.id === semesterId);
  const scope = [
    classes.find((c) => c.id === classId)?.name,
    sem ? t("semesterN", { n: sem.index }) : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  const link = (kind: string) =>
    `/api/reports?kind=${kind}&class=${classId}&semester=${semesterId}&locale=${locale}`;

  const reports: { kind: string; label: string; needsSemester?: boolean }[] = [
    { kind: "class-list", label: t("classList") },
    { kind: "grades", label: t("gradeSummary"), needsSemester: true },
    { kind: "fees", label: t("feeLedger") },
    { kind: "attendance", label: t("attendanceStats") },
  ];

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} eyebrow={scope} />
      <ClassSemesterPicker
        classes={classes.map((c) => ({ id: c.id, label: c.name }))}
        semesters={semesters.map((s, i) => ({ id: s.id, label: `${t("semester")} ${s.index ?? i + 1}` }))}
        classId={classId}
        semesterId={semesterId}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <Card key={r.kind} className="flex items-center justify-between gap-3">
            <span className="font-medium">{r.label}</span>
            {r.needsSemester && !semesterId ? (
              <span className="text-xs text-[var(--muted)]">{t("needsSemester")}</span>
            ) : (
              <a
                href={link(r.kind)}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-black/[0.03]"
              >
                <Download className="size-4" />
                CSV
              </a>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
