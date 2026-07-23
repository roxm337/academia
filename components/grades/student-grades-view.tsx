import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { Mark, MarkHeadline } from "@/components/ui/mark";
import { localized } from "@/lib/school";
import { studentResult } from "@/lib/data/grades";

/**
 * A student's published results for one semester — the per-subject averages,
 * the coefficient-weighted general average, mention and rank, plus a link to
 * the bulletin PDF. Shared by the student's own page and the parent view.
 *
 * Every /20 here is the `Mark` signature, the same one the bulletin and the
 * gradebook use, so a family sees one consistent treatment of a mark wherever
 * it appears — not a different arrangement of `toFixed(2)` per screen.
 */
export async function StudentGradesView({
  studentId,
  classId,
  semesterId,
  locale,
}: {
  studentId: string;
  classId: string;
  semesterId: string;
  locale: string;
}) {
  const t = await getTranslations("grades");
  const { result, stats, classSize } = await studentResult(classId, studentId, semesterId);

  if (!result) {
    return <Card className="text-sm text-[var(--muted)]">{t("noItems")}</Card>;
  }

  const mention = result.mention ? t(`mentions.${result.mention}`) : "";
  const rankMeta = [
    `${t("rank")} ${result.rank ?? "—"} ${t("of")} ${classSize}`,
    mention,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      {/* The one place the mark is allowed to be loud: the headline average. */}
      <Card>
        <MarkHeadline
          value={result.general}
          label={t("generalAverage")}
          emptyLabel="—"
          meta={rankMeta}
        />
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-[var(--ink)]">{t("subjectPerformance")}</h2>
          <span className="text-xs text-[var(--muted)]">/ 20</span>
        </div>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {result.subjects.map((s) => (
            <div key={s.subjectId} className="flex items-center justify-between gap-4">
              <span className="min-w-0 truncate text-sm font-medium text-[var(--ink)]">
                {localized(s, locale)}
              </span>
              {/* showBar: a subject list is a set of marks being compared, which
                  is exactly where the band bar earns its place. */}
              <Mark value={s.average} emptyLabel="—" size="sm" showBar className="items-end" />
            </div>
          ))}
        </div>
      </Card>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>{t("selectSubject")}</Th>
              <Th className="text-center">{t("coefficient")}</Th>
              <Th className="text-end">{t("average")}</Th>
            </tr>
          </thead>
          <tbody>
            {result.subjects.map((s) => (
              <tr key={s.subjectId}>
                <Td>{localized(s, locale)}</Td>
                <Td className="text-center tabular">{s.coefficient}</Td>
                <Td className="text-end">
                  <Mark value={s.average} emptyLabel="—" size="sm" className="items-end" />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          {result.mention ? <Badge tone="neutral">{mention}</Badge> : null}
          <span>
            {t("classAverage")}:{" "}
            <span className="tabular text-[var(--ink)]">
              {stats.average === null ? "—" : stats.average.toFixed(2)}
            </span>
          </span>
        </div>
        <a
          href={`/api/bulletin/pdf?student=${studentId}&semester=${semesterId}&locale=${locale}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-black/[0.03]"
        >
          <FileText className="size-4" />
          {t("viewBulletin")}
        </a>
      </div>
    </div>
  );
}
