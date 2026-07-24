import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { ClassSemesterPicker } from "@/components/grades/class-semester-picker";
import { CouncilEntryForm, RefreshCouncilButton } from "@/components/grades/council-forms";
import { requireRole } from "@/lib/dal";
import { listClassesLite } from "@/lib/data/timetable";
import { semestersOf } from "@/lib/data/grades";
import { councilForClass } from "@/lib/data/council";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/director/council">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("DIRECTOR");

  const t = await getTranslations("grades");
  const tc = await getTranslations("grades.council");
  const sp = await searchParams;

  const [classes, semesters] = await Promise.all([listClassesLite(), semestersOf()]);
  if (classes.length === 0 || semesters.length === 0) {
    return (
      <>
        <PageHeader title={tc("title")} subtitle={tc("subtitle")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  const classId = classes.some((c) => c.id === sp.class) ? String(sp.class) : classes[0].id;
  const semesterId = semesters.some((s) => s.id === sp.semester)
    ? String(sp.semester)
    : semesters[0].id;

  const { rows, stats, semester, archivedCount } = await councilForClass(
    classId,
    semesterId,
  );
  const locked = Boolean(semester?.isLocked);
  const scope = [
    classes.find((c) => c.id === classId)?.name,
    semester ? t("semesterN", { n: semester.index }) : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  const name = (s: {
    firstNameAr: string;
    lastNameAr: string;
    firstNameFr: string;
    lastNameFr: string;
  }) => (locale === "ar" ? `${s.firstNameAr} ${s.lastNameAr}` : `${s.firstNameFr} ${s.lastNameFr}`);

  return (
    <>
      <PageHeader title={tc("title")} subtitle={tc("subtitle")} eyebrow={scope} />

      <ClassSemesterPicker
        classes={classes.map((c) => ({ id: c.id, label: c.name }))}
        semesters={semesters.map((s) => ({ id: s.id, label: t("semesterN", { n: s.index }) }))}
        classId={classId}
        semesterId={semesterId}
      />

      <Card className="my-5 space-y-3">
        <p className="text-sm text-[var(--muted)]">
          {locked ? tc("finalNotice") : tc("openNotice")}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <Badge tone={locked ? "success" : "neutral"}>
              {locked ? tc("archived") : tc("notArchived")}
            </Badge>
            <span>{tc("archivedCount", { count: archivedCount })}</span>
            <span aria-hidden="true">·</span>
            <span>
              {t("classAverage")}: {stats.average ?? "—"}
            </span>
          </div>
          <RefreshCouncilButton classId={classId} semesterId={semesterId} disabled={locked} />
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState message={t("noStudentsInClass")} />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("rank")}</Th>
                <Th>{t("student")}</Th>
                <Th>{t("generalAverage")}</Th>
                <Th>{t("mention")}</Th>
                <Th>{tc("decision")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId}>
                  <Td>{r.rank ?? "—"}</Td>
                  <Td>
                    <span className="font-medium">{name(r)}</span>
                    <span className="ms-2 text-xs text-[var(--muted)]" dir="ltr">
                      {r.codeMassar}
                    </span>
                  </Td>
                  <Td>{r.general ?? t("notGraded")}</Td>
                  <Td>{r.mention ? t(`mentions.${r.mention}`) : "—"}</Td>
                  <Td>
                    <CouncilEntryForm
                      studentId={r.studentId}
                      classId={classId}
                      semesterId={semesterId}
                      decision={r.decision}
                      directorAppreciation={r.directorAppreciation}
                      suggestion={r.suggestion}
                      frozen={r.frozen}
                    />
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
