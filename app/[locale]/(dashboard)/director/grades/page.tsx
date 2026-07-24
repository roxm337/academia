import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { Mark } from "@/components/ui/mark";
import { ClassSemesterPicker } from "@/components/grades/class-semester-picker";
import { SemesterControls } from "@/components/grades/semester-controls";
import { requireRole } from "@/lib/dal";
import { listClassesLite } from "@/lib/data/timetable";
import { semestersOf, computeClassResults } from "@/lib/data/grades";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/director/grades">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("DIRECTOR");

  const t = await getTranslations("grades");
  const sp = await searchParams;

  const [classes, semesters] = await Promise.all([listClassesLite(), semestersOf()]);
  if (classes.length === 0 || semesters.length === 0) {
    return (
      <>
        <PageHeader title={t("overviewTitle")} subtitle={t("overviewSubtitle")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  const classId = classes.some((c) => c.id === sp.class) ? String(sp.class) : classes[0].id;
  const semesterId = semesters.some((s) => s.id === sp.semester) ? String(sp.semester) : semesters[0].id;

  const { students, stats } = await computeClassResults(classId, semesterId);
  const scope = [
    classes.find((c) => c.id === classId)?.name,
    t("semesterN", { n: semesters.find((s) => s.id === semesterId)!.index }),
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  const name = (s: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${s.firstNameAr} ${s.lastNameAr}` : `${s.firstNameFr} ${s.lastNameFr}`;

  return (
    <>
      <PageHeader title={t("overviewTitle")} subtitle={t("overviewSubtitle")} eyebrow={scope} />

      {/* Lock / publish each semester */}
      <div className="mb-6 space-y-2">
        {semesters.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <span className="font-medium">{t("semesterN", { n: s.index })}</span>
            <SemesterControls
              semesterId={s.id}
              isLocked={s.isLocked}
              isPublished={Boolean(s.gradesPublishedAt)}
            />
          </div>
        ))}
      </div>

      <ClassSemesterPicker
        classes={classes.map((c) => ({ id: c.id, label: c.name }))}
        semesters={semesters.map((s) => ({ id: s.id, label: t("semesterN", { n: s.index }) }))}
        classId={classId}
        semesterId={semesterId}
      />

      <dl className="mb-4 flex flex-wrap gap-x-10 gap-y-3 border-y border-[var(--line)] py-3">
        {[
          { k: t("classAverage"), v: stats.average },
          { k: t("min"), v: stats.min },
          { k: t("max"), v: stats.max },
        ].map((stat) => (
          <div key={stat.k}>
            <dt className="eyebrow">{stat.k}</dt>
            <dd className="mt-1">
              <Mark value={stat.v} emptyLabel={t("notGraded")} size="sm" />
            </dd>
          </div>
        ))}
      </dl>

      {students.length === 0 ? (
        <EmptyState message={t("noItems")} />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("rank")}</Th>
                <Th>{t("student")}</Th>
                <Th>{t("general")}</Th>
                <Th>{t("mention")}</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.studentId}>
                  <Td className="tabular w-12 text-center text-[var(--muted)]">
                    {s.rank ?? "\u2014"}
                  </Td>
                  <Td className="whitespace-nowrap font-medium">{name(s)}</Td>
                  <Td>
                    <Mark value={s.general} emptyLabel={t("notGraded")} showBar />
                  </Td>
                  <Td>
                    {s.mention ? <Badge tone="neutral">{t(`mentions.${s.mention}`)}</Badge> : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
