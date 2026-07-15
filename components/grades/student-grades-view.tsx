import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { localized } from "@/lib/school";
import { studentResult } from "@/lib/data/grades";

/**
 * A student's published results for one semester — the per-subject averages,
 * the coefficient-weighted general average, mention and rank, plus a link to
 * the bulletin PDF. Shared by the student's own page and the parent view.
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

  return (
    <div className="space-y-4">
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>{t("selectSubject")}</Th>
              <Th className="text-center">{t("coefficient")}</Th>
              <Th className="text-center">{t("average")}</Th>
            </tr>
          </thead>
          <tbody>
            {result.subjects.map((s) => (
              <tr key={s.subjectId}>
                <Td>{localized(s, locale)}</Td>
                <Td className="text-center">{s.coefficient}</Td>
                <Td className="text-center font-mono">{s.average?.toFixed(2) ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold">
            {t("generalAverage")}: {result.general?.toFixed(2) ?? "—"} / 20
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
            <span>{t("rank")}: {result.rank ?? "—"} {t("of")} {classSize}</span>
            {result.mention ? <Badge tone="neutral">{t(`mentions.${result.mention}`)}</Badge> : null}
            <span>{t("classAverage")}: {stats.average?.toFixed(2) ?? "—"}</span>
          </div>
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
