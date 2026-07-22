"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { createLesson, updateLesson, updateUnit } from "@/lib/actions/lessons";
import type { ActionState } from "@/lib/actions/structure";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { CloseOnSuccess, Modal } from "@/components/ui/modal";
import { DOC_ACCEPT } from "@/lib/upload-accept";

/**
 * Curriculum choices, already localized by the server page — `localized()`
 * lives in the server-only school module, so the label arrives as a string
 * rather than a bilingual row.
 */
export type CurriculumOption = {
  levelId: string;
  levelLabel: string;
  specialityId: string | null;
  specialityLabel: string | null;
  subjectId: string;
  subjectLabel: string;
};

type LessonFields = {
  id: string;
  titleAr: string;
  titleFr: string;
  contentAr: string;
  contentFr: string;
  isPublished: boolean;
};

/** New unit + first lesson, or a new lesson inside an existing unit. */
export function LessonCreateModal({
  options,
  unit,
}: {
  options: CurriculumOption[];
  /** Present when adding to an existing unit — its coordinates are fixed. */
  unit?: { id: string; levelId: string; specialityId: string | null; subjectId: string; titleAr: string; titleFr: string };
}) {
  const t = useTranslations("lessons");
  const te = useTranslations("lessons.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(createLesson, null);

  const levels = dedupe(options.map((o) => [o.levelId, o.levelLabel] as const));
  const streams = dedupe(
    options.filter((o) => o.specialityId).map((o) => [o.specialityId!, o.specialityLabel!] as const),
  );
  const subjects = dedupe(options.map((o) => [o.subjectId, o.subjectLabel] as const));
  // "All streams" means a unit with no stream, which the server only accepts
  // from a teacher who actually teaches a stream-less class (collège has no
  // streams). Offering it to a lycée-only teacher would just earn them a
  // refusal after they filled the whole form in.
  const canTargetAllStreams = options.some((o) => o.specialityId === null);

  return (
    <Modal
      title={unit ? t("newLessonInUnit") : t("newLesson")}
      trigger={
        unit ? (
          <Button variant="outline" size="sm">
            <Plus className="size-4" aria-hidden="true" />
            {t("newLessonInUnit")}
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" aria-hidden="true" />
            {t("newLesson")}
          </Button>
        )
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          {unit ? (
            <>
              <input type="hidden" name="unitId" value={unit.id} />
              <input type="hidden" name="levelId" value={unit.levelId} />
              <input type="hidden" name="specialityId" value={unit.specialityId ?? ""} />
              <input type="hidden" name="subjectId" value={unit.subjectId} />
              <input type="hidden" name="unitTitleAr" value={unit.titleAr} />
              <input type="hidden" name="unitTitleFr" value={unit.titleFr} />
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="levelId">{t("level")}</Label>
                  <Select id="levelId" name="levelId" required>
                    {levels.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="specialityId">{t("stream")}</Label>
                  <Select id="specialityId" name="specialityId" required={!canTargetAllStreams}>
                    {canTargetAllStreams ? (
                      <option value="">{t("allStreams")}</option>
                    ) : null}
                    {streams.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subjectId">{t("subject")}</Label>
                  <Select id="subjectId" name="subjectId" required>
                    {subjects.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <UnitTitleFields />
            </>
          )}

          <LessonFieldsGroup />
          <PublishAndAttachment />
          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <Actions close={close} pending={pending} />
        </form>
      )}
    </Modal>
  );
}

/** Edits the lesson only. The unit it belongs to is renamed from its own form. */
export function LessonEditModal({ lesson }: { lesson: LessonFields }) {
  const t = useTranslations("lessons");
  const te = useTranslations("lessons.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(updateLesson, null);

  return (
    <Modal
      title={t("editLesson")}
      trigger={
        <Button variant="ghost" size="sm" aria-label={t("editLesson")}>
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="lessonId" value={lesson.id} />
          <LessonFieldsGroup lesson={lesson} />
          <PublishAndAttachment isPublished={lesson.isPublished} />
          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <Actions close={close} pending={pending} />
        </form>
      )}
    </Modal>
  );
}

export function UnitEditModal({
  unit,
}: {
  unit: { id: string; titleAr: string; titleFr: string };
}) {
  const t = useTranslations("lessons");
  const te = useTranslations("lessons.errors");
  const [state, action, pending] = useActionState<ActionState, FormData>(updateUnit, null);

  return (
    <Modal
      title={t("editUnit")}
      trigger={
        <Button variant="ghost" size="sm" aria-label={t("editUnit")}>
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      }
    >
      {(close) => (
        <form action={action} className="space-y-4">
          <input type="hidden" name="unitId" value={unit.id} />
          <UnitTitleFields unit={unit} />
          {state?.error ? <FieldError>{te(state.error)}</FieldError> : null}
          <CloseOnSuccess ok={state?.ok} close={close} />
          <Actions close={close} pending={pending} />
        </form>
      )}
    </Modal>
  );
}

function UnitTitleFields({ unit }: { unit?: { titleAr: string; titleFr: string } }) {
  const t = useTranslations("lessons");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="unitTitleFr">{t("unitTitleFr")}</Label>
        <Input id="unitTitleFr" name="unitTitleFr" required defaultValue={unit?.titleFr} />
      </div>
      <div>
        <Label htmlFor="unitTitleAr">{t("unitTitleAr")}</Label>
        <Input
          id="unitTitleAr"
          name="unitTitleAr"
          dir="rtl"
          lang="ar"
          required
          defaultValue={unit?.titleAr}
        />
      </div>
    </div>
  );
}

function LessonFieldsGroup({ lesson }: { lesson?: LessonFields }) {
  const t = useTranslations("lessons");
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="lessonTitleFr">{t("lessonTitleFr")}</Label>
          <Input
            id="lessonTitleFr"
            name="lessonTitleFr"
            required
            defaultValue={lesson?.titleFr}
          />
        </div>
        <div>
          <Label htmlFor="lessonTitleAr">{t("lessonTitleAr")}</Label>
          <Input
            id="lessonTitleAr"
            name="lessonTitleAr"
            dir="rtl"
            lang="ar"
            required
            defaultValue={lesson?.titleAr}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contentFr">{t("contentFr")}</Label>
          <Textarea
            id="contentFr"
            name="contentFr"
            rows={8}
            required
            defaultValue={lesson?.contentFr}
          />
        </div>
        <div>
          <Label htmlFor="contentAr">{t("contentAr")}</Label>
          <Textarea
            id="contentAr"
            name="contentAr"
            dir="rtl"
            lang="ar"
            rows={8}
            required
            defaultValue={lesson?.contentAr}
          />
        </div>
      </div>
    </>
  );
}

function PublishAndAttachment({ isPublished }: { isPublished?: boolean }) {
  const t = useTranslations("lessons");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isPublished"
          defaultChecked={isPublished ?? false}
          className="size-4"
        />
        {t("publish")}
      </label>
      <div>
        <Label htmlFor="file">{t("attachment")}</Label>
        <input
          id="file"
          type="file"
          name="file"
          accept={DOC_ACCEPT}
          multiple
          className="block w-full text-sm"
        />
        <p className="mt-1.5 text-xs text-[var(--muted)]">{t("attachmentHint")}</p>
      </div>
    </div>
  );
}

function Actions({ close, pending }: { close: () => void; pending: boolean }) {
  const tc = useTranslations("common");
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={close}>
        {tc("cancel")}
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? tc("loading") : tc("save")}
      </Button>
    </div>
  );
}

/** First label wins; keeps <option> lists stable and free of duplicates. */
function dedupe(pairs: ReadonlyArray<readonly [string, string]>): [string, string][] {
  return [...new Map(pairs).entries()];
}
