"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Send } from "lucide-react";
import { startThread, sendMessage } from "@/lib/actions/messaging";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

export function NewThreadModal({
  recipients,
}: {
  recipients: { userId: string; label: string }[];
}) {
  const t = useTranslations("messages");
  const tc = useTranslations("common");
  const te = useTranslations("messages.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(startThread, null);

  return (
    <Modal
      title={t("newMessage")}
      trigger={<Button size="sm"><Plus className="size-4" />{t("newMessage")}</Button>}
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {recipients.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("noRecipients")}</p>
          ) : (
            <>
              <div>
                <Label htmlFor="recipientId">{t("recipient")}</Label>
                <Select id="recipientId" name="recipientId" required defaultValue="">
                  <option value="" disabled>—</option>
                  {recipients.map((r) => (
                    <option key={r.userId} value={r.userId}>{r.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="subject">{t("subject")}</Label>
                <Input id="subject" name="subject" required />
              </div>
              <div>
                <Label htmlFor="body">{t("message")}</Label>
                <Textarea id="body" name="body" rows={4} required />
              </div>
            </>
          )}
          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>{tc("cancel")}</Button>
            <Button type="submit" disabled={pending || recipients.length === 0}>
              {pending ? tc("loading") : t("send")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function Composer({ threadId }: { threadId: string }) {
  const t = useTranslations("messages");
  const tc = useTranslations("common");
  const te = useTranslations("messages.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(sendMessage, null);

  return (
    <form action={action} className="mt-4 space-y-2">
      {/* React 19 resets the uncontrolled fields after a successful action. */}
      <input type="hidden" name="threadId" value={threadId} />
      <Textarea name="body" rows={3} required placeholder={t("reply")} aria-label={t("message")} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf"
          className="text-sm file:me-3 file:rounded-lg file:border-0 file:bg-black/[0.06] file:px-3 file:py-2 file:text-sm" />
        <Button type="submit" disabled={pending}>
          <Send className="size-4" />{pending ? tc("loading") : t("send")}
        </Button>
      </div>
      {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
    </form>
  );
}
