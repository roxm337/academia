import { getTranslations, setRequestLocale } from "next-intl/server";
import { Download, FileText } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { ClassSemesterPicker } from "@/components/grades/class-semester-picker";
import { requireRole } from "@/lib/dal";
import { listClassesLite } from "@/lib/data/timetable";
import { semestersOf, computeClassResults } from "@/lib/data/grades";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/director/bulletins">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("DIRECTOR");

  const t = await getTranslations("grades");
  const sp = await searchParams;

  const [classes, semesters] = await Promise.all([listClassesLite(), semestersOf()]);
  if (classes.length === 0 || semesters.length === 0) {
    return (
      <>
        <PageHeader title={t("bulletin")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  const classId = classes.some((c) => c.id === sp.class) ? String(sp.class) : classes[0].id;
  const semesterId = semesters.some((s) => s.id === sp.semester) ? String(sp.semester) : semesters[0].id;
  const semesterIndex = semesters.find((s) => s.id === semesterId)!.index;

  const { students } = await computeClassResults(classId, semesterId);

  const name = (s: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${s.firstNameAr} ${s.lastNameAr}` : `${s.firstNameFr} ${s.lastNameFr}`;

  const bulletinHref = (studentId: string) =>
    `/api/bulletin/pdf?student=${studentId}&semester=${semesterId}&locale=${locale}`;
  const bookletHref = `/api/bulletin/booklet?class=${classId}&semester=${semesterId}&locale=${locale}`;

  return (
    <>
      <PageHeader title={t("bulletin")} subtitle={t("semesterN", { n: semesterIndex })} />
      <ClassSemesterPicker
        classes={classes.map((c) => ({ id: c.id, label: c.name }))}
        semesters={semesters.map((s) => ({ id: s.id, label: t("semesterN", { n: s.index }) }))}
        classId={classId}
        semesterId={semesterId}
      />

      {students.length > 0 ? (
        <div className="mb-4 flex justify-end">
          <a
            href={bookletHref}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-black/[0.03]"
          >
            <Download className="size-4" aria-hidden="true" />
            {t("downloadBooklet", { count: students.length })}
          </a>
        </div>
      ) : null}

      {students.length === 0 ? (
        <Card className="text-sm text-[var(--muted)]">{t("noItems")}</Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("rank")}</Th>
                <Th>{t("student")}</Th>
                <Th className="text-center">{t("general")}</Th>
                <Th>{t("mention")}</Th>
                <Th className="text-end">{t("bulletin")}</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.studentId}>
                  <Td className="text-center font-mono">{s.rank ?? "—"}</Td>
                  <Td className="whitespace-nowrap font-medium">{name(s)}</Td>
                  <Td className="text-center font-mono font-semibold">{s.general?.toFixed(2) ?? "—"}</Td>
                  <Td>{s.mention ? <Badge tone="neutral">{t(`mentions.${s.mention}`)}</Badge> : "—"}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <a
                        href={bulletinHref(s.studentId)}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-black/[0.03]"
                      >
                        <FileText className="size-4" aria-hidden="true" />
                        {t("viewBulletin")}
                      </a>
                    </div>
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
