"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import {
  addAssignment,
  saveTeacher,
  type TeacherState,
} from "@/lib/actions/staff";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";

type Option = { id: string; label: string };

function Err({ error }: { error?: string }) {
  const te = useTranslations("director.errors");
  if (!error) return null;
  return <FieldError>{te(error)}</FieldError>;
}

export function TeacherForm({
  subjects,
  teacher,
}: {
  subjects: Option[];
  teacher?: {
    id: string;
    email: string;
    firstNameAr: string;
    lastNameAr: string;
    firstNameFr: string;
    lastNameFr: string;
    phone: string | null;
    employeeNo: string | null;
    specialty: string | null;
    subjectIds: string[];
  };
}) {
  const t = useTranslations("director.staff");
  const ts = useTranslations("director.students");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<TeacherState, FormData>(
    saveTeacher,
    null,
  );

  return (
    <Modal
      title={teacher ? t("title") : t("newTeacher")}
      trigger={
        teacher ? (
          <Button variant="ghost" size="sm">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t("newTeacher")}
          </Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {teacher ? <input type="hidden" name="id" value={teacher.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tt-lastNameAr">{ts("name")} (ع)</Label>
              <Input
                id="tt-lastNameAr"
                name="lastNameAr"
                required
                dir="rtl"
                lang="ar"
                defaultValue={teacher?.lastNameAr}
              />
            </div>
            <div>
              <Label htmlFor="tt-firstNameAr">&nbsp;</Label>
              <Input
                id="tt-firstNameAr"
                name="firstNameAr"
                required
                dir="rtl"
                lang="ar"
                defaultValue={teacher?.firstNameAr}
              />
            </div>
            <div>
              <Label htmlFor="tt-lastNameFr">{ts("name")} (FR)</Label>
              <Input
                id="tt-lastNameFr"
                name="lastNameFr"
                required
                dir="ltr"
                lang="fr"
                defaultValue={teacher?.lastNameFr}
              />
            </div>
            <div>
              <Label htmlFor="tt-firstNameFr">&nbsp;</Label>
              <Input
                id="tt-firstNameFr"
                name="firstNameFr"
                required
                dir="ltr"
                lang="fr"
                defaultValue={teacher?.firstNameFr}
              />
            </div>

            <div>
              <Label htmlFor="tt-email">{ts("email")}</Label>
              <Input
                id="tt-email"
                name="email"
                type="email"
                required
                dir="ltr"
                defaultValue={teacher?.email}
              />
            </div>
            <div>
              <Label htmlFor="tt-phone">{ts("phone")}</Label>
              <Input
                id="tt-phone"
                name="phone"
                dir="ltr"
                defaultValue={teacher?.phone ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="tt-employeeNo">{t("employeeNo")}</Label>
              <Input
                id="tt-employeeNo"
                name="employeeNo"
                dir="ltr"
                defaultValue={teacher?.employeeNo ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="tt-specialty">{t("specialty")}</Label>
              <Input
                id="tt-specialty"
                name="specialty"
                defaultValue={teacher?.specialty ?? ""}
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              {t("subjectsTaught")}
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="subjectIds"
                    value={s.id}
                    defaultChecked={teacher?.subjectIds.includes(s.id)}
                    className="size-4 accent-[var(--brand)]"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          <Err error={state?.error} />

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

export function AssignmentForm({
  teacherId,
  classes,
  subjects,
}: {
  teacherId: string;
  classes: Option[];
  subjects: Option[];
}) {
  const t = useTranslations("director.staff");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addAssignment,
    null,
  );

  return (
    <Modal
      title={t("addAssignment")}
      trigger={
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          {t("addAssignment")}
        </Button>
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="teacherId" value={teacherId} />

          <div>
            <Label htmlFor="a-classId">{t("class")}</Label>
            <Select id="a-classId" name="classId" required defaultValue="">
              <option value="" disabled />
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="a-subjectId">{t("subject")}</Label>
            <Select id="a-subjectId" name="subjectId" required defaultValue="">
              <option value="" disabled />
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          <p className="text-xs text-[var(--muted)]">{t("assignmentHint")}</p>

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
