import { getTranslations } from "next-intl/server";
import { Paperclip } from "lucide-react";
import { Badge, Card } from "@/components/ui/field";
import { SubmitHomeworkModal } from "@/components/pedagogy/homework-forms";
import { localized } from "@/lib/school";
import { homeworkForStudent } from "@/lib/data/homework";
import { dueStatus } from "@/lib/homework";

const DUE_TONE = { upcoming: "neutral", dueSoon: "warn", overdue: "danger" } as const;

/**
 * Published homework for a student's class, each with their submission status
 * and the teacher's feedback. `canSubmit` gates the turn-in control: the student
 * may submit; the parent sees the same picture read-only.
 */
export async function StudentHomeworkList({
  classId,
  studentId,
  locale,
  canSubmit,
}: {
  classId: string;
  studentId: string;
  locale: string;
  canSubmit: boolean;
}) {
  const t = await getTranslations("homework");
  const rows = await homeworkForStudent(classId, studentId);
  const now = new Date();
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  if (rows.length === 0) {
    return <Card className="text-sm text-[var(--muted)]">{t("notPublished")}</Card>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((h) => {
        const sub = h.mySubmission;
        return (
          <Card key={h.id} className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{h.title}</p>
                <p className="text-xs text-[var(--muted)]">{localized(h.subject, locale)}</p>
              </div>
              <Badge tone={DUE_TONE[dueStatus(h.dueAt, now)]}>{t("dueDate")} {dateStr(h.dueAt)}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm">{h.instructions}</p>
            {h.attachments.map((a) => (
              <a key={a.id} href={`/api/files/${a.file.path}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-[var(--brand)] hover:underline">
                <Paperclip className="size-3.5" />{a.file.filename}
              </a>
            ))}

            {/* Submission state */}
            <div className="mt-2 border-t border-[var(--border)] pt-2">
              {sub ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={sub.isLate ? "danger" : "success"}>
                      {sub.isLate ? t("late") : t("onTime")}
                    </Badge>
                    <span className="text-xs text-[var(--muted)]">
                      {t("submittedOn")} {sub.submittedAt.toISOString().slice(0, 10)}
                    </span>
                    {sub.grade !== null ? (
                      <Badge tone="neutral">{t("grade")}: {Number(sub.grade).toFixed(2)}/20</Badge>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">{t("awaitingReview")}</span>
                    )}
                  </div>
                  {sub.attachments.map((a) => (
                    <a key={a.id} href={`/api/files/${a.file.path}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline">
                      <Paperclip className="size-3" />{a.file.filename}
                    </a>
                  ))}
                  {sub.teacherComment ? (
                    <p className="text-sm"><span className="text-[var(--muted)]">{t("feedback")}: </span>{sub.teacherComment}</p>
                  ) : null}
                  {canSubmit ? (
                    <div className="pt-1">
                      <SubmitHomeworkModal homeworkId={h.id} resubmit note={sub.studentNote ?? ""} />
                    </div>
                  ) : null}
                </div>
              ) : canSubmit ? (
                <SubmitHomeworkModal homeworkId={h.id} resubmit={false} note="" />
              ) : (
                <Badge tone="warn">{t("notSubmitted")}</Badge>
              )}
            </div>
          </Card>
        );
      })}
    </ul>
  );
}
