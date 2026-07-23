import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { GradePicker } from "@/components/grades/grade-picker";
import {
  GradeItemModal,
  ScoresModal,
  AppreciationModal,
} from "@/components/grades/gradebook-forms";
import { DeleteForm } from "@/components/director/delete-form";
import { requireRole } from "@/lib/dal";
import { deleteGradeItem } from "@/lib/actions/grades";
import {
  teacherClassSubjects,
  semestersOf,
  gradeItemsFor,
  gradeRoster,
  appreciationsFor,
} from "@/lib/data/grades";
import { localized } from "@/lib/school";
import { subjectAverage } from "@/lib/grades";
import { Mark } from "@/components/ui/mark";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/teacher/grades">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");

  const t = await getTranslations("grades");
  const sp = await searchParams;

  const [profile, semesters] = await Promise.all([
    teacherClassSubjects(user.id),
    semestersOf(),
  ]);

  if (!profile || profile.assignments.length === 0 || semesters.length === 0) {
    return (
      <>
        <PageHeader title={t("gradebook")} subtitle={t("subtitle")} />
        <EmptyState message={t("noSubject")} />
      </>
    );
  }

  // Build the pickers from the teacher's own assignments only.
  const classMap = new Map<string, string>();
  const subjectsByClass: Record<string, { id: string; label: string }[]> = {};
  for (const a of profile.assignments) {
    classMap.set(a.class.id, a.class.name);
    (subjectsByClass[a.class.id] ??= []).push({
      id: a.subject.id,
      label: `${a.subject.code} — ${localized(a.subject, locale)}`,
    });
  }
  const classes = [...classMap].map(([id, name]) => ({ id, label: name }));
  const semOpts = semesters.map((s) => ({ id: s.id, label: t("semesterN", { n: s.index }) }));

  // Resolve the selection, validated against the teacher's assignments.
  const classId = classes.some((c) => c.id === sp.class) ? String(sp.class) : classes[0].id;
  const validSubjects = subjectsByClass[classId] ?? [];
  const subjectId = validSubjects.some((s) => s.id === sp.subject)
    ? String(sp.subject)
    : (validSubjects[0]?.id ?? "");
  const semesterId = semesters.some((s) => s.id === sp.semester)
    ? String(sp.semester)
    : semesters[0].id;

  const owns = profile.assignments.some((a) => a.class.id === classId && a.subject.id === subjectId);

  const [items, roster, apprMap, semester] = await Promise.all([
    owns ? gradeItemsFor(classId, subjectId, semesterId) : Promise.resolve([]),
    gradeRoster(classId),
    appreciationsFor(classId, subjectId, semesterId),
    semesters.find((s) => s.id === semesterId)!,
  ]);
  const locked = semester.isLocked;

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;

  // score lookup: itemId -> studentId -> score
  const scoreOf = new Map<string, Map<string, number | null>>();
  for (const it of items) {
    const m = new Map<string, number | null>();
    for (const g of it.grades) m.set(g.studentId, g.score === null ? null : Number(g.score));
    scoreOf.set(it.id, m);
  }

  return (
    <>
      <PageHeader title={t("gradebook")} subtitle={t("subtitle")} />
      <GradePicker
        classes={classes}
        subjectsByClass={subjectsByClass}
        semesters={semOpts}
        classId={classId}
        subjectId={subjectId}
        semesterId={semesterId}
      />

      {locked ? (
        <Card className="mb-4 text-sm text-amber-800">{t("locked")}</Card>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <GradeItemModal classId={classId} subjectId={subjectId} semesterId={semesterId} />
        </div>
      )}

      {/* Evaluations */}
      {items.length === 0 ? (
        <EmptyState message={t("noItems")} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {items.map((it) => {
              const existing: Record<string, number | null> = {};
              for (const [sid, sc] of scoreOf.get(it.id) ?? []) existing[sid] = sc;
              const label = `${it.kind === "CONTROLE" ? t("controle") : t("activite")} ${it.index}${it.label ? ` · ${it.label}` : ""}`;
              return (
                <div key={it.id} className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
                  <span className="text-sm">{label}</span>
                  <Badge tone="neutral">/{Number(it.maxScore)}</Badge>
                  {!locked ? (
                    <>
                      <ScoresModal
                        item={{ id: it.id, label, maxScore: Number(it.maxScore) }}
                        roster={roster.map((s) => ({ id: s.id, label: name(s.user) }))}
                        existing={existing}
                      />
                      <GradeItemModal
                        classId={classId}
                        subjectId={subjectId}
                        semesterId={semesterId}
                        item={{ id: it.id, kind: it.kind, index: it.index, label: it.label, maxScore: Number(it.maxScore), weight: Number(it.weight) }}
                      />
                      <DeleteForm action={deleteGradeItem} id={it.id} />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Per-student grid */}
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t("student")}</Th>
                  {items.map((it) => (
                    <Th key={it.id} className="text-center">
                      {it.kind === "CONTROLE" ? t("controle") : t("activite")} {it.index}
                    </Th>
                  ))}
                  <Th className="text-center">{t("average")}</Th>
                  <Th className="text-center">{t("appreciation")}</Th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => {
                  const inputs = items.map((it) => ({
                    score: scoreOf.get(it.id)?.get(s.id) ?? null,
                    maxScore: Number(it.maxScore),
                    weight: Number(it.weight),
                  }));
                  const avg = subjectAverage(inputs);
                  return (
                    <tr key={s.id}>
                      <Td className="whitespace-nowrap font-medium">{name(s.user)}</Td>
                      {items.map((it) => {
                        const sc = scoreOf.get(it.id)?.get(s.id) ?? null;
                        return (
                          <Td key={it.id} className="text-center font-mono text-xs">
                            {sc === null ? "—" : sc.toFixed(2)}
                          </Td>
                        );
                      })}
                      {/* The subject average is a /20: it gets the same Mark
                          signature the bulletin uses, with the band bar since a
                          gradebook column is exactly where marks are compared. */}
                      <Td className="text-center">
                        <Mark value={avg} emptyLabel="—" size="sm" showBar />
                      </Td>
                      <Td className="text-center">
                        {!locked ? (
                          <AppreciationModal
                            studentId={s.id}
                            classId={classId}
                            subjectId={subjectId}
                            semesterId={semesterId}
                            studentName={name(s.user)}
                            text={apprMap.get(s.id) ?? ""}
                          />
                        ) : (
                          <span className="text-xs text-[var(--muted)]">{apprMap.get(s.id) ?? "—"}</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </>
      )}
    </>
  );
}
