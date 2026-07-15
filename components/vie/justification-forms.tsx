"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Check, X } from "lucide-react";
import {
  submitJustification,
  reviewJustification,
} from "@/lib/actions/justifications";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

/** Parent/student files a request to excuse an absence. */
export function SubmitJustificationModal({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName?: string;
}) {
  const t = useTranslations("vie.justifications");
  const tc = useTranslations("common");
  const te = useTranslations("vie.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    submitJustification,
    null,
  );

  return (
    <Modal
      title={studentName ? t("submitFor", { name: studentName }) : t("submit")}
      trigger={
        <Button size="sm">
          <Plus className="size-4" />
          {t("submit")}
        </Button>
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <div>
            <Label htmlFor="reason">{t("reason")}</Label>
            <Textarea id="reason" name="reason" required rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="fromDate">{t("from")}</Label>
              <Input id="fromDate" name="fromDate" type="date" dir="ltr" required />
            </div>
            <div>
              <Label htmlFor="toDate">{t("to")}</Label>
              <Input id="toDate" name="toDate" type="date" dir="ltr" required />
            </div>
          </div>
          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? tc("loading") : tc("save")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Surveillant approves or rejects one pending request. */
export function ReviewJustification({ id }: { id: string }) {
  const t = useTranslations("vie.justifications");
  const [, action, pending] = useActionState<ActionState, FormData>(
    reviewJustification,
    null,
  );
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        name="decision"
        value="APPROVE"
        disabled={pending}
        aria-label={t("approve")}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        <Check className="size-3.5" />
        {t("approve")}
      </button>
      <button
        type="submit"
        name="decision"
        value="REJECT"
        disabled={pending}
        aria-label={t("reject")}
        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        <X className="size-3.5" />
        {t("reject")}
      </button>
    </form>
  );
}
