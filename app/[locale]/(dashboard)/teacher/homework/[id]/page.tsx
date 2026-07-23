import { getTranslations, setRequestLocale } from "next-intl/server";
import { Paperclip } from "lucide-react";
import { Mark } from "@/components/ui/mark";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { ReviewSubmissionModal } from "@/components/pedagogy/homework-forms";
import { requireRole, teacherOwning } from "@/lib/dal";
import { redirect } from "@/i18n/navigation";
import { homeworkDetail } from "@/lib/data/homework";

export default async function Page({
  params,
}: PageProps<"/[locale]/teacher/homework/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireRole("TEACHER");

  const t = await getTranslations("homework");
  const hw = await homeworkDetail(id);
  // Only the teacher who owns this homework's class+subject may see the rendus.
  if (!hw || !(await teacherOwning(user.id, hw.classId, hw.subjectId))) {
    redirect({ href: "/teacher/homework", locale });
  }
  const homework = hw!;

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;
  const dt = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

  return (
    <>
      <PageHeader title={homework.title} subtitle={`${t("dueDate")} ${homework.dueAt.toISOString().slice(0, 10)}`} />
      <Card className="mb-4 whitespace-pre-wrap text-sm">{homework.instructions}</Card>

      {homework.submissions.length === 0 ? (
        <EmptyState message={t("none")} />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("student")}</Th>
                <Th>{t("submittedOn")}</Th>
                <Th>{t("status")}</Th>
                <Th>{t("studentNote")}</Th>
                <Th>{t("grade")}</Th>
                <Th className="text-end">{t("review")}</Th>
              </tr>
            </thead>
            <tbody>
              {homework.submissions.map((s) => (
                <tr key={s.id}>
                  <Td className="whitespace-nowrap font-medium">{name(s.student.user)}</Td>
                  <Td className="whitespace-nowrap font-mono text-xs">{dt(s.submittedAt)}</Td>
                  <Td>
                    <Badge tone={s.isLate ? "danger" : "success"}>
                      {s.isLate ? t("late") : t("onTime")}
                    </Badge>
                  </Td>
                  <Td className="max-w-xs">
                    <div className="space-y-1">
                      {s.studentNote ? <p className="truncate text-sm">{s.studentNote}</p> : null}
                      {s.attachments.map((a) => (
                        <a key={a.id} href={`/api/files/${a.file.path}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline">
                          <Paperclip className="size-3" />{a.file.filename}
                        </a>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-center">
                    {s.grade === null ? (
                      <span className="text-xs text-[var(--muted)]">{t("awaitingReview")}</span>
                    ) : (
                      <Mark value={Number(s.grade)} emptyLabel="—" size="sm" />
                    )}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <ReviewSubmissionModal
                        submissionId={s.id}
                        studentName={name(s.student.user)}
                        grade={s.grade === null ? "" : String(Number(s.grade))}
                        comment={s.teacherComment ?? ""}
                      />
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
