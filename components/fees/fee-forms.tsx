"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Wallet, Percent, FileStack, BellRing } from "lucide-react";
import {
  saveFeeItem, generateSchedule, generateClassSchedules,
  setDiscount, recordPayment, sendReminders,
} from "@/lib/actions/fees";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

type Opt = { id: string; label: string };
const KINDS = ["INSCRIPTION", "TUITION", "TRANSPORT", "CANTINE", "INSURANCE", "BOOKS", "OTHER"];
const METHODS = ["CASH", "CHECK", "TRANSFER"];

function Err({ state, ns }: { state: ActionState; ns: string }) {
  const te = useTranslations(ns);
  if (!state?.error) return null;
  return <FieldError>{te(state.error)}</FieldError>;
}

// ---------------------------------------------------------------- fee item

export function FeeItemModal({ levels, item }: {
  levels: Opt[];
  item?: { id: string; levelId: string | null; kind: string; nameAr: string; nameFr: string; amount: number; isMonthly: boolean };
}) {
  const t = useTranslations("fees");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(saveFeeItem, null);

  return (
    <Modal
      title={item ? t("editItem") : t("newItem")}
      trigger={item ? <Button variant="ghost" size="sm"><Pencil className="size-4" /></Button> : <Button size="sm"><Plus className="size-4" />{t("newItem")}</Button>}
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="kind">{t("kind")}</Label>
              <Select id="kind" name="kind" defaultValue={item?.kind ?? "TUITION"}>
                {KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="levelId">{t("level")}</Label>
              <Select id="levelId" name="levelId" defaultValue={item?.levelId ?? ""}>
                <option value="">{t("allLevels")}</option>
                {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="nameFr">{t("nameFr")}</Label>
              <Input id="nameFr" name="nameFr" dir="ltr" lang="fr" required defaultValue={item?.nameFr} />
            </div>
            <div>
              <Label htmlFor="nameAr">{t("nameAr")}</Label>
              <Input id="nameAr" name="nameAr" dir="rtl" lang="ar" required defaultValue={item?.nameAr} />
            </div>
            <div>
              <Label htmlFor="amount">{t("amount")} (MAD)</Label>
              <Input id="amount" name="amount" type="number" min={0} step="0.01" dir="ltr" required defaultValue={item?.amount} />
            </div>
            <label className="flex items-end gap-2 pb-2">
              <input type="checkbox" name="isMonthly" defaultChecked={item?.isMonthly ?? false} className="size-4" />
              <span className="text-sm">{t("monthly")}</span>
            </label>
          </div>
          <Err state={state} ns="fees.errors" />
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

// ---------------------------------------------------------------- payment

export function PaymentModal({ studentId }: { studentId: string }) {
  const t = useTranslations("fees");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(recordPayment, null);

  return (
    <Modal title={t("recordPayment")} trigger={<Button size="sm"><Wallet className="size-4" />{t("recordPayment")}</Button>}>
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="amount">{t("amount")} (MAD)</Label>
              <Input id="amount" name="amount" type="number" min={0.01} step="0.01" dir="ltr" required />
            </div>
            <div>
              <Label htmlFor="method">{t("method")}</Label>
              <Select id="method" name="method" defaultValue="CASH">
                {METHODS.map((m) => <option key={m} value={m}>{t(`methods.${m}`)}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="reference">{t("reference")}</Label>
              <Input id="reference" name="reference" />
            </div>
            <div>
              <Label htmlFor="note">{t("note")}</Label>
              <Input id="note" name="note" />
            </div>
          </div>
          <Err state={state} ns="fees.errors" />
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

// ---------------------------------------------------------------- discount

export function DiscountModal({ scheduleId, sibling, custom, note }: {
  scheduleId: string; sibling: number; custom: number; note: string;
}) {
  const t = useTranslations("fees");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(setDiscount, null);

  return (
    <Modal title={t("setDiscount")} trigger={<Button variant="outline" size="sm"><Percent className="size-4" />{t("setDiscount")}</Button>}>
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="siblingDiscount">{t("siblingDiscount")} (MAD)</Label>
              <Input id="siblingDiscount" name="siblingDiscount" type="number" min={0} step="0.01" dir="ltr" defaultValue={sibling} />
            </div>
            <div>
              <Label htmlFor="customDiscount">{t("customDiscount")} (MAD)</Label>
              <Input id="customDiscount" name="customDiscount" type="number" min={0} step="0.01" dir="ltr" defaultValue={custom} />
            </div>
          </div>
          <div>
            <Label htmlFor="discountNote">{t("discountNote")}</Label>
            <Textarea id="discountNote" name="discountNote" rows={2} defaultValue={note} />
          </div>
          <Err state={state} ns="fees.errors" />
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

// ---------------------------------------------------------------- generate / reminders

export function GenerateScheduleForm({ studentId }: { studentId: string }) {
  const t = useTranslations("fees");
  const [, action, pending] = useActionState<ActionState, FormData>(generateSchedule, null);
  return (
    <form action={action}>
      <input type="hidden" name="studentId" value={studentId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}><FileStack className="size-4" />{t("generate")}</Button>
    </form>
  );
}

export function GenerateClassForm({ classId }: { classId: string }) {
  const t = useTranslations("fees");
  const [, action, pending] = useActionState<ActionState, FormData>(generateClassSchedules, null);
  return (
    <form action={action}>
      <input type="hidden" name="classId" value={classId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}><FileStack className="size-4" />{t("generateClass")}</Button>
    </form>
  );
}

export function RemindersForm() {
  const t = useTranslations("fees");
  const [state, action, pending] = useActionState<ActionState, FormData>(sendReminders, null);
  return (
    <form action={action}>
      <Button type="submit" size="sm" variant="outline" disabled={pending}><BellRing className="size-4" />{t("sendReminders")}</Button>
      {state?.ok ? <span className="ms-2 text-xs text-emerald-700">✓</span> : null}
    </form>
  );
}
