"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Upload, CheckSquare } from "lucide-react";
import { saveHomework, submitHomework, reviewSubmission } from "@/lib/actions/homework";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

const fileInput =
  "block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-black/[0.06] file:px-3 file:py-2 file:text-sm";

// ---------------------------------------------------------------- teacher

export function HomeworkModal({
  classId,
  subjectId,
  homework,
}: {
  classId: string;
  subjectId: string;
  homework?: { id: string; title: string; instructions: string; dueDate: string; isPublished: boolean };
}) {
  const t = useTranslations("homework");
  const tc = useTranslations("common");
  const te = useTranslations("homework.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveHomework, null);

  return (
    <Modal
      title={homework ? t("editHomework") : t("newHomework")}
      trigger={
        homework ? (
          <Button variant="ghost" size="sm"><Pencil className="size-4" /></Button>
        ) : (
          <Button size="sm"><Plus className="size-4" />{t("newHomework")}</Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="subjectId" value={subjectId} />
          {homework ? <input type="hidden" name="id" value={homework.id} /> : null}

          <div>
            <Label htmlFor="title">{t("hwTitle")}</Label>
            <Input id="title" name="title" required defaultValue={homework?.title} />
          </div>
          <div>
            <Label htmlFor="instructions">{t("instructions")}</Label>
            <Textarea id="instructions" name="instructions" rows={4} required defaultValue={homework?.instructions} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dueDate">{t("dueDate")}</Label>
              <Input id="dueDate" name="dueDate" type="date" dir="ltr" required defaultValue={homework?.dueDate} />
            </div>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" name="isPublished" defaultChecked={homework?.isPublished ?? true} className="size-4" />
              <span className="text-sm">{t("publish")}</span>
            </label>
          </div>
          <div>
            <Label htmlFor="file">{t("attachment")}</Label>
            <input id="file" type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={fileInput} />
          </div>

          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>{tc("cancel")}</Button>
            <Button type="submit" disabled={pending}>{pending ? tc("loading") : tc("save")}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function ReviewSubmissionModal({
  submissionId,
  studentName,
  grade,
  comment,
}: {
  submissionId: string;
  studentName: string;
  grade: string;
  comment: string;
}) {
  const t = useTranslations("homework");
  const tc = useTranslations("common");
  const te = useTranslations("homework.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(reviewSubmission, null);

  return (
    <Modal
      title={`${t("review")} — ${studentName}`}
      trigger={<Button variant="outline" size="sm"><CheckSquare className="size-4" />{t("review")}</Button>}
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="submissionId" value={submissionId} />
          <div>
            <Label htmlFor="grade">{t("grade")} (/20)</Label>
            <Input id="grade" name="grade" type="number" min={0} max={20} step="0.25" dir="ltr" defaultValue={grade} />
          </div>
          <div>
            <Label htmlFor="teacherComment">{t("teacherComment")}</Label>
            <Textarea id="teacherComment" name="teacherComment" rows={3} defaultValue={comment} />
          </div>
          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>{tc("cancel")}</Button>
            <Button type="submit" disabled={pending}>{pending ? tc("loading") : tc("save")}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- student

export function SubmitHomeworkModal({
  homeworkId,
  resubmit,
  note,
}: {
  homeworkId: string;
  resubmit: boolean;
  note: string;
}) {
  const t = useTranslations("homework");
  const tc = useTranslations("common");
  const te = useTranslations("homework.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(submitHomework, null);

  return (
    <Modal
      title={resubmit ? t("resubmit") : t("submit")}
      trigger={
        <Button size="sm" variant={resubmit ? "outline" : "primary"}>
          <Upload className="size-4" />
          {resubmit ? t("resubmit") : t("submit")}
        </Button>
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="homeworkId" value={homeworkId} />
          <div>
            <Label htmlFor="studentNote">{t("studentNote")}</Label>
            <Textarea id="studentNote" name="studentNote" rows={3} defaultValue={note} />
          </div>
          <div>
            <Label htmlFor="file">{t("attachment")}</Label>
            <input id="file" type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" className={fileInput} />
          </div>
          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>{tc("cancel")}</Button>
            <Button type="submit" disabled={pending}>{pending ? tc("loading") : tc("save")}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
