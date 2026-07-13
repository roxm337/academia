"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Upload } from "lucide-react";
import {
  addGuardian,
  saveStudent,
  setStudentStatus,
  transferStudent,
  uploadStudentDocument,
  uploadStudentPhoto,
  type GuardianState,
} from "@/lib/actions/students";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

type Option = { id: string; label: string };

const DOC_KINDS = ["BIRTH_CERTIFICATE", "ID", "MEDICAL", "OTHER"] as const;

function Err({ error }: { error?: string }) {
  const te = useTranslations("director.errors");
  if (!error) return null;
  return <FieldError>{te(error)}</FieldError>;
}

// ---------------------------------------------------------------- student

export function StudentForm({
  classes,
  student,
}: {
  classes: Option[];
  student?: {
    id: string;
    codeMassar: string;
    cne: string | null;
    firstNameAr: string;
    lastNameAr: string;
    firstNameFr: string;
    lastNameFr: string;
    birthDate: string;
    birthPlaceAr: string | null;
    birthPlaceFr: string | null;
    gender: string | null;
  };
}) {
  const t = useTranslations("director.students");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveStudent,
    null,
  );

  return (
    <Modal
      title={student ? t("identity") : t("newStudent")}
      trigger={
        student ? (
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            {tc("save")}
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("newStudent")}
          </Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {student ? <input type="hidden" name="id" value={student.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="codeMassar">{t("codeMassar")}</Label>
              <Input
                id="codeMassar"
                name="codeMassar"
                required
                dir="ltr"
                placeholder="A123456789"
                defaultValue={student?.codeMassar}
              />
            </div>
            <div>
              <Label htmlFor="cne">{t("cne")}</Label>
              <Input id="cne" name="cne" dir="ltr" defaultValue={student?.cne ?? ""} />
            </div>

            <div>
              <Label htmlFor="lastNameAr">{t("name")} (ع)</Label>
              <Input
                id="lastNameAr"
                name="lastNameAr"
                required
                dir="rtl"
                lang="ar"
                defaultValue={student?.lastNameAr}
              />
            </div>
            <div>
              <Label htmlFor="firstNameAr">&nbsp;</Label>
              <Input
                id="firstNameAr"
                name="firstNameAr"
                required
                dir="rtl"
                lang="ar"
                defaultValue={student?.firstNameAr}
              />
            </div>

            <div>
              <Label htmlFor="lastNameFr">{t("name")} (FR)</Label>
              <Input
                id="lastNameFr"
                name="lastNameFr"
                required
                dir="ltr"
                lang="fr"
                defaultValue={student?.lastNameFr}
              />
            </div>
            <div>
              <Label htmlFor="firstNameFr">&nbsp;</Label>
              <Input
                id="firstNameFr"
                name="firstNameFr"
                required
                dir="ltr"
                lang="fr"
                defaultValue={student?.firstNameFr}
              />
            </div>

            <div>
              <Label htmlFor="birthDate">{t("birthDate")}</Label>
              <Input
                id="birthDate"
                name="birthDate"
                type="date"
                required
                dir="ltr"
                defaultValue={student?.birthDate}
              />
            </div>
            <div>
              <Label htmlFor="gender">{t("gender")}</Label>
              <Select id="gender" name="gender" defaultValue={student?.gender ?? ""}>
                <option value="" />
                <option value="M">{t("male")}</option>
                <option value="F">{t("female")}</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="birthPlaceAr">{t("birthPlace")} (ع)</Label>
              <Input
                id="birthPlaceAr"
                name="birthPlaceAr"
                dir="rtl"
                lang="ar"
                defaultValue={student?.birthPlaceAr ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="birthPlaceFr">{t("birthPlace")} (FR)</Label>
              <Input
                id="birthPlaceFr"
                name="birthPlaceFr"
                dir="ltr"
                lang="fr"
                defaultValue={student?.birthPlaceFr ?? ""}
              />
            </div>

            {!student ? (
              <div className="sm:col-span-2">
                <Label htmlFor="classId">{t("class")}</Label>
                <Select id="classId" name="classId" defaultValue="">
                  <option value="">{t("noClass")}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>

          <Err error={state?.error} />
          <CloseOnSuccess ok={state?.ok} close={close} />

          <div className="mt-5 flex justify-end gap-2">
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

// ---------------------------------------------------------------- guardian

export function GuardianForm({ studentId }: { studentId: string }) {
  const t = useTranslations("director.students");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<GuardianState, FormData>(
    addGuardian,
    null,
  );

  return (
    <Modal
      title={t("addGuardian")}
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          {t("addGuardian")}
        </Button>
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="g-lastNameAr">{t("name")} (ع)</Label>
              <Input id="g-lastNameAr" name="lastNameAr" required dir="rtl" lang="ar" />
            </div>
            <div>
              <Label htmlFor="g-firstNameAr">&nbsp;</Label>
              <Input id="g-firstNameAr" name="firstNameAr" required dir="rtl" lang="ar" />
            </div>
            <div>
              <Label htmlFor="g-lastNameFr">{t("name")} (FR)</Label>
              <Input id="g-lastNameFr" name="lastNameFr" required dir="ltr" lang="fr" />
            </div>
            <div>
              <Label htmlFor="g-firstNameFr">&nbsp;</Label>
              <Input id="g-firstNameFr" name="firstNameFr" required dir="ltr" lang="fr" />
            </div>
            <div>
              <Label htmlFor="g-relation">{t("relation")}</Label>
              <Select id="g-relation" name="relation" defaultValue="FATHER">
                <option value="FATHER">{t("FATHER")}</option>
                <option value="MOTHER">{t("MOTHER")}</option>
                <option value="TUTOR">{t("TUTOR")}</option>
                <option value="OTHER">{t("OTHER")}</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="g-phone">{t("phone")}</Label>
              <Input id="g-phone" name="phone" required dir="ltr" placeholder="+212 6.." />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="g-email">{t("email")}</Label>
              <Input id="g-email" name="email" type="email" dir="ltr" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPrimary" className="size-4 accent-[var(--brand)]" />
            {t("isPrimary")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="createAccount"
              className="size-4 accent-[var(--brand)]"
            />
            {t("createParentAccount")}
          </label>
          <p className="text-xs text-[var(--muted)]">{t("parentAccountHint")}</p>

          <Err error={state?.error} />

          {/* Shown once. The director writes it down and hands it to the parent. */}
          {state?.tempPassword ? (
            <div className="rounded-lg bg-amber-50 p-3 text-sm">
              <p className="font-medium">{state.email}</p>
              <p className="mt-1 font-mono text-base" dir="ltr">
                {state.tempPassword}
              </p>
            </div>
          ) : (
            <CloseOnSuccess ok={state?.ok} close={close} />
          )}

          <div className="mt-5 flex justify-end gap-2">
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

// ---------------------------------------------------------------- transfer

export function TransferForm({
  studentId,
  classes,
  currentClassId,
}: {
  studentId: string;
  classes: Option[];
  currentClassId?: string;
}) {
  const t = useTranslations("director.students");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    transferStudent,
    null,
  );

  return (
    <Modal
      title={t("transfer")}
      trigger={
        <Button variant="outline" size="sm">
          {t("transfer")}
        </Button>
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <div>
            <Label htmlFor="t-classId">{t("class")}</Label>
            <Select
              id="t-classId"
              name="classId"
              required
              defaultValue={currentClassId ?? ""}
            >
              <option value="" disabled />
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <Err error={state?.error} />
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

// ---------------------------------------------------------------- status

export function StatusForm({
  studentId,
  status,
}: {
  studentId: string;
  status: string;
}) {
  const t = useTranslations("director.students");
  const [, action, pending] = useActionState<ActionState, FormData>(
    setStudentStatus,
    null,
  );
  const archiving = status === "ACTIVE";

  return (
    <form action={action}>
      <input type="hidden" name="id" value={studentId} />
      <input type="hidden" name="status" value={archiving ? "ARCHIVED" : "ACTIVE"} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
        className={archiving ? "text-red-700" : ""}
      >
        {archiving ? t("archive") : t("restore")}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- uploads

export function PhotoUpload({ studentId }: { studentId: string }) {
  const t = useTranslations("director.students");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadStudentPhoto,
    null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="studentId" value={studentId} />
      <Label htmlFor="photo">{t("photo")}</Label>
      <input
        id="photo"
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        required
        className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-black/[0.06] file:px-3 file:py-2 file:text-sm"
      />
      <Err error={state?.error} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <Upload className="size-4" />
        {t("photo")}
      </Button>
    </form>
  );
}

export function DocumentUpload({ studentId }: { studentId: string }) {
  const t = useTranslations("director.students");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    uploadStudentDocument,
    null,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="studentId" value={studentId} />
      <Label htmlFor="doc">{t("uploadDocument")}</Label>
      <Select name="kind" defaultValue="BIRTH_CERTIFICATE" aria-label={t("documentKind")}>
        {DOC_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`docKinds.${k}`)}
          </option>
        ))}
      </Select>
      <input
        id="doc"
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required
        className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-black/[0.06] file:px-3 file:py-2 file:text-sm"
      />
      <Err error={state?.error} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <Upload className="size-4" />
        {t("uploadDocument")}
      </Button>
    </form>
  );
}
