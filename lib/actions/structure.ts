"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { currentYear } from "@/lib/data/structure";

/**
 * Structure writes. Every one of these re-checks the DIRECTOR role: a Server
 * Action is a public POST endpoint, so the page that rendered the form is not
 * a guard.
 */

export type ActionState = {
  ok?: boolean;
  error?: string; // message key under "errors"
  fieldErrors?: Record<string, string>;
} | null;

const bilingual = {
  nameAr: z.string().trim().min(1),
  nameFr: z.string().trim().min(1),
};

// ---------------------------------------------------------------- levels

const levelSchema = z.object({
  id: z.string().optional(),
  cycleId: z.string().min(1),
  code: z.string().trim().min(1).max(12).toUpperCase(),
  order: z.coerce.number().int().min(0).max(99),
  ...bilingual,
});

export async function saveLevel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = levelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const { id, ...data } = parsed.data;

  // Level codes are referenced by imports and bulletins — they must stay unique.
  const clash = await prisma.level.findFirst({
    where: { code: data.code, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) return { error: "duplicateCode" };

  const before = id
    ? await prisma.level.findUnique({ where: { id } })
    : null;

  const level = id
    ? await prisma.level.update({ where: { id }, data })
    : await prisma.level.create({ data });

  await audit({
    actorId: actor.id,
    action: id ? "LEVEL_UPDATE" : "LEVEL_CREATE",
    entity: "Level",
    entityId: level.id,
    before,
    after: level,
  });

  revalidatePath("/[locale]/(dashboard)/director/classes", "page");
  return { ok: true };
}

export async function deleteLevel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  // Refuse to delete a level that still has classes — deleting would cascade
  // away enrolments and grades. Make the director empty it first.
  const classCount = await prisma.class.count({ where: { levelId: id } });
  if (classCount > 0) return { error: "levelHasClasses" };

  const before = await prisma.level.findUnique({ where: { id } });
  await prisma.level.delete({ where: { id } });

  await audit({
    actorId: actor.id,
    action: "LEVEL_DELETE",
    entity: "Level",
    entityId: id,
    before,
  });

  revalidatePath("/[locale]/(dashboard)/director/classes", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- streams

const streamSchema = z.object({
  id: z.string().optional(),
  levelId: z.string().min(1),
  code: z.string().trim().min(1).max(12).toUpperCase(),
  ...bilingual,
});

export async function saveStream(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = streamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const { id, ...data } = parsed.data;

  const clash = await prisma.stream.findFirst({
    where: {
      levelId: data.levelId,
      code: data.code,
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });
  if (clash) return { error: "duplicateCode" };

  const stream = id
    ? await prisma.stream.update({ where: { id }, data })
    : await prisma.stream.create({ data });

  await audit({
    actorId: actor.id,
    action: id ? "STREAM_UPDATE" : "STREAM_CREATE",
    entity: "Stream",
    entityId: stream.id,
    after: stream,
  });

  revalidatePath("/[locale]/(dashboard)/director/classes", "page");
  return { ok: true };
}

export async function deleteStream(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  const classCount = await prisma.class.count({ where: { streamId: id } });
  if (classCount > 0) return { error: "streamHasClasses" };

  await prisma.stream.delete({ where: { id } });
  await audit({
    actorId: actor.id,
    action: "STREAM_DELETE",
    entity: "Stream",
    entityId: id,
  });

  revalidatePath("/[locale]/(dashboard)/director/classes", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- classes

const classSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  levelId: z.string().min(1),
  streamId: z.string().optional(),
  capacity: z.coerce.number().int().min(1).max(80).optional().or(z.literal("").transform(() => undefined)),
  mainTeacherId: z.string().optional(),
});

export async function saveClass(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const year = await currentYear();
  if (!year) return { error: "noSchoolYear" };

  const raw = Object.fromEntries(formData);
  const parsed = classSchema.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };

  const { id, streamId, mainTeacherId, capacity, ...rest } = parsed.data;

  const data = {
    ...rest,
    schoolYearId: year.id,
    streamId: streamId || null,
    mainTeacherId: mainTeacherId || null,
    capacity: capacity ?? null,
  };

  const clash = await prisma.class.findFirst({
    where: {
      name: data.name,
      schoolYearId: year.id,
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });
  if (clash) return { error: "duplicateClassName" };

  const before = id ? await prisma.class.findUnique({ where: { id } }) : null;

  const klass = id
    ? await prisma.class.update({ where: { id }, data })
    : await prisma.class.create({ data });

  await audit({
    actorId: actor.id,
    action: id ? "CLASS_UPDATE" : "CLASS_CREATE",
    entity: "Class",
    entityId: klass.id,
    before,
    after: klass,
  });

  revalidatePath("/[locale]/(dashboard)/director/classes", "page");
  return { ok: true };
}

export async function deleteClass(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  // A class with students still in it must be emptied first — cascading here
  // would silently delete enrolments, grades and attendance.
  const enrolled = await prisma.enrollment.count({
    where: { classId: id, isActive: true },
  });
  if (enrolled > 0) return { error: "classHasStudents" };

  const before = await prisma.class.findUnique({ where: { id } });
  await prisma.class.delete({ where: { id } });

  await audit({
    actorId: actor.id,
    action: "CLASS_DELETE",
    entity: "Class",
    entityId: id,
    before,
  });

  revalidatePath("/[locale]/(dashboard)/director/classes", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- subjects

const subjectSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(1).max(12).toUpperCase(),
  ...bilingual,
});

export async function saveSubject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = subjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const { id, ...data } = parsed.data;

  const clash = await prisma.subject.findFirst({
    where: { code: data.code, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (clash) return { error: "duplicateCode" };

  const subject = id
    ? await prisma.subject.update({ where: { id }, data })
    : await prisma.subject.create({ data });

  await audit({
    actorId: actor.id,
    action: id ? "SUBJECT_UPDATE" : "SUBJECT_CREATE",
    entity: "Subject",
    entityId: subject.id,
    after: subject,
  });

  revalidatePath("/[locale]/(dashboard)/director/subjects", "page");
  return { ok: true };
}

export async function deleteSubject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  const graded = await prisma.gradeItem.count({ where: { subjectId: id } });
  if (graded > 0) return { error: "subjectHasGrades" };

  await prisma.subject.delete({ where: { id } });
  await audit({
    actorId: actor.id,
    action: "SUBJECT_DELETE",
    entity: "Subject",
    entityId: id,
  });

  revalidatePath("/[locale]/(dashboard)/director/subjects", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- coefficients

const coefficientSchema = z.object({
  levelId: z.string().min(1),
  streamId: z.string().optional(),
  subjectId: z.string().min(1),
  coefficient: z.coerce.number().min(0).max(20),
});

/**
 * Sets (or clears) one subject's coefficient for a level/stream.
 * A coefficient of 0 removes the subject from that level entirely.
 */
export async function setCoefficient(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = coefficientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const { levelId, subjectId, coefficient } = parsed.data;
  const streamId = parsed.data.streamId || null;

  const existing = await prisma.levelSubject.findFirst({
    where: { levelId, streamId, subjectId },
  });

  if (coefficient === 0) {
    if (existing) {
      await prisma.levelSubject.delete({ where: { id: existing.id } });
      await audit({
        actorId: actor.id,
        action: "COEFFICIENT_DELETE",
        entity: "LevelSubject",
        entityId: existing.id,
        before: existing,
      });
    }
  } else if (existing) {
    const updated = await prisma.levelSubject.update({
      where: { id: existing.id },
      data: { coefficient },
    });
    await audit({
      actorId: actor.id,
      action: "COEFFICIENT_UPDATE",
      entity: "LevelSubject",
      entityId: existing.id,
      before: existing,
      after: updated,
    });
  } else {
    const created = await prisma.levelSubject.create({
      data: { levelId, streamId, subjectId, coefficient },
    });
    await audit({
      actorId: actor.id,
      action: "COEFFICIENT_CREATE",
      entity: "LevelSubject",
      entityId: created.id,
      after: created,
    });
  }

  revalidatePath("/[locale]/(dashboard)/director/subjects", "page");
  return { ok: true };
}
