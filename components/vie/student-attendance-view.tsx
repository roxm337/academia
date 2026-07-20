import { getTranslations } from "next-intl/server";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { SubmitJustificationModal } from "@/components/vie/justification-forms";
import { localized } from "@/lib/school";
import { currentYear } from "@/lib/data/structure";
import {
  absenceSummary,
  studentAttendance,
  studentJustifications,
  studentIncidents,
} from "@/lib/data/attendance";
import { minToLabel } from "@/lib/timetable";

const STATUS_TONE = {
  PRESENT: "success",
  LATE: "warn",
  ABSENT: "danger",
} as const;

const JUST_TONE = {
  PENDING: "warn",
  APPROVED: "success",
  REJECTED: "danger",
} as const;

/**
 * A student's own attendance picture — summary, recent records, their
 * justifications and any incidents. Shared by the parent view (for each child)
 * and the student's own page; `canSubmit` decides whether the "justify"
 * control appears (both parent and student may file).
 */
export async function StudentAttendanceView({
  studentId,
  studentName,
  locale,
  canSubmit,
}: {
  studentId: string;
  studentName: string;
  locale: string;
  canSubmit: boolean;
}) {
  const t = await getTranslations("vie.attendance");
  const tj = await getTranslations("vie.justifications");
  const td = await getTranslations("vie.discipline");
  const tt = await getTranslations("vie.types");
  const ts = await getTranslations("vie.sanctions");

  const year = await currentYear();
  const from = year?.startDate ?? new Date(Date.UTC(2000, 0, 1));
  const to = year?.endDate ?? new Date();

  const [summary, records, justifications, incidents] = await Promise.all([
    absenceSummary(studentId),
    studentAttendance(studentId, from, to),
    studentJustifications(studentId),
    studentIncidents(studentId),
  ]);

  const dateStr = (d: Date) => d.toISOString().slice(0, 10);
  const nonPresentRecords = records.filter((r) => r.status !== "PRESENT");
  const attendanceRate = records.length
    ? Math.round(((records.length - summary.absent) / records.length) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="text-center">
            <div className="text-2xl font-semibold">{summary.absent}</div>
            <div className="text-xs text-[var(--muted)]">{t("absences")}</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-semibold text-red-700">{summary.unexcused}</div>
            <div className="text-xs text-[var(--muted)]">{t("unexcused")}</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-semibold text-amber-700">{summary.late}</div>
            <div className="text-xs text-[var(--muted)]">{t("lates")}</div>
          </Card>
          <Card className="text-center">
            <div className="text-2xl font-semibold text-[var(--brand)]">{attendanceRate == null ? "—" : `${attendanceRate}%`}</div>
            <div className="text-xs text-[var(--muted)]">{t("attendanceRate")}</div>
          </Card>
        </div>
        {canSubmit ? (
          <div className="ms-auto">
            <SubmitJustificationModal studentId={studentId} studentName={studentName} />
          </div>
        ) : null}
      </div>

      {/* Recent attendance records */}
      {nonPresentRecords.length === 0 ? (
        <Card className="text-sm text-[var(--muted)]">{t("noRecords")}</Card>
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("date")}</Th>
                <Th>{t("subject")}</Th>
                <Th>{t("status")}</Th>
              </tr>
            </thead>
            <tbody>
              {nonPresentRecords.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap font-mono text-xs">
                      {dateStr(r.session.date)} · {minToLabel(r.session.startMin)}
                    </Td>
                    <Td>{localized(r.session.subject, locale)}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[r.status]}>
                        {t(r.status.toLowerCase())}
                      </Badge>
                      {r.isExcused ? (
                        <Badge tone="neutral" className="ms-1">{tj("approved")}</Badge>
                      ) : null}
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </TableWrap>
      )}

      {/* Justifications */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">{tj("myTitle")}</h2>
        {justifications.length === 0 ? (
          <Card className="text-sm text-[var(--muted)]">{tj("none")}</Card>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{tj("from")}</Th>
                  <Th>{tj("to")}</Th>
                  <Th>{tj("reason")}</Th>
                  <Th>{tj("status")}</Th>
                </tr>
              </thead>
              <tbody>
                {justifications.map((j) => (
                  <tr key={j.id}>
                    <Td className="whitespace-nowrap font-mono text-xs">{dateStr(j.fromDate)}</Td>
                    <Td className="whitespace-nowrap font-mono text-xs">{dateStr(j.toDate)}</Td>
                    <Td className="max-w-xs truncate">{j.reason}</Td>
                    <Td>
                      <Badge tone={JUST_TONE[j.status]}>{tj(j.status.toLowerCase())}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      {/* Incidents */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">{td("myTitle")}</h2>
        {incidents.length === 0 ? (
          <Card className="text-sm text-[var(--muted)]">{td("none")}</Card>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{td("occurredAt")}</Th>
                  <Th>{td("type")}</Th>
                  <Th>{td("sanction")}</Th>
                  <Th>{td("description")}</Th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <Td className="whitespace-nowrap font-mono text-xs">{dateStr(i.occurredAt)}</Td>
                    <Td>{tt(i.type)}</Td>
                    <Td>
                      {i.sanction === "NONE" ? (
                        <span className="text-[var(--muted)]">—</span>
                      ) : (
                        <Badge tone="warn">{ts(i.sanction)}</Badge>
                      )}
                    </Td>
                    <Td className="max-w-xs truncate">{i.description}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>
    </div>
  );
}
