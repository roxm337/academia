"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { currentYear } from "@/lib/data/structure";
import type { ActionState } from "@/lib/actions/structure";

export type TeacherState =
  | (NonNullable<ActionState> & { tempPassword?: string; email?: string })
  | null;

const teacherSchema = z.object({
  id: z.string().optional(),
  email: z.string().email(),
  firstNameAr: z.string().trim().min(1),
  lastNameAr: z.string().trim().min(1),
  firstNameFr: z.string().trim().min(1),
  lastNameFr: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  employeeNo: z.string().trim().optional(),
  specialty: z.string().trim().optional(),
  subjectIds: z.array(z.string()).optional(),
});

export async function saveTeacher(
  _prev: TeacherState,
  formData: FormData,
): Promise<TeacherState> {
  const actor = await requireRole("DIRECTOR");

  const parsed = teacherSchema.safeParse({
    ...Object.fromEntries(formData),
    subjectIds: formData.getAll("subjectIds").map(String),
  });
  if (!parsed.success) return { error: "invalid" };

  const d = parsed.data;
  const email = d.email.toLowerCase().trim();
  const subjectIds = d.subjectIds ?? [];

  if (d.id) {
    const before = await prisma.teacherProfile.findUnique({
      where: { id: d.id },
      include: { user: true, subjects: true },
    });
    if (!before) return { error: "notFound" };

    const emailTaken = await prisma.user.findFirst({
      where: { email, NOT: { id: before.userId } },
      select: { id: true },
    });
    if (emailTaken) return { error: "emailTaken" };

    await prisma.$transaction(async (tx) => {
      await tx.teacherProfile.update({
        where: { id: d.id },
        data: {
          employeeNo: d.employeeNo || null,
          specialty: d.specialty || null,
          user: {
            update: {
              email,
              firstNameAr: d.firstNameAr,
              lastNameAr: d.lastNameAr,
              firstNameFr: d.firstNameFr,
              lastNameFr: d.lastNameFr,
              phone: d.phone || null,
            },
          },
        },
      });
      // Replace the taught-subjects set wholesale — simpler than diffing, and
      // this table is tiny.
      await tx.teacherSubject.deleteMany({ where: { teacherId: d.id } });
      if (subjectIds.length) {
        await tx.teacherSubject.createMany({
          data: subjectIds.map((subjectId) => ({ teacherId: d.id!, subjectId })),
        });
      }
    });

    await audit({
      actorId: actor.id,
      action: "TEACHER_UPDATE",
      entity: "TeacherProfile",
      entityId: d.id,
      before,
      after: { email, subjectIds },
    });

    revalidatePath("/[locale]/(dashboard)/director/staff", "page");
    return { ok: true };
  }

  const taken = await prisma.user.findUnique({ where: { email } });
  if (taken) return { error: "emailTaken" };

  // Shown once to the director, who hands it to the teacher.
  const tempPassword = randomBytes(6).toString("base64url");

  const created = await prisma.teacherProfile.create({
    data: {
      employeeNo: d.employeeNo || null,
      specialty: d.specialty || null,
      user: {
        create: {
          email,
          passwordHash: await bcrypt.hash(tempPassword, 10),
          role: "TEACHER",
          locale: "fr",
          firstNameAr: d.firstNameAr,
          lastNameAr: d.lastNameAr,
          firstNameFr: d.firstNameFr,
          lastNameFr: d.lastNameFr,
          phone: d.phone || null,
        },
      },
      subjects: { create: subjectIds.map((subjectId) => ({ subjectId })) },
    },
  });

  await audit({
    actorId: actor.id,
    action: "TEACHER_CREATE",
    entity: "TeacherProfile",
    entityId: created.id,
    after: { email, subjectIds },
  });

  revalidatePath("/[locale]/(dashboard)/director/staff", "page");
  return { ok: true, tempPassword, email };
}

// ---------------------------------------------------------------- assignments

const assignmentSchema = z.object({
  teacherId: z.string().min(1),
  classId: z.string().min(1),
  subjectId: z.string().min(1),
});

/**
 * Gives a teacher a class+subject for the year.
 *
 * The schema enforces one teacher per (class, subject, year), which is the rule
 * the gradebook depends on — two teachers owning the same gradebook would make
 * "whose grade is this?" unanswerable. Report the clash instead of throwing.
 */
export async function addAssignment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const year = await currentYear();
  if (!year) return { error: "noSchoolYear" };

  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const { teacherId, classId, subjectId } = parsed.data;

  const existing = await prisma.teacherAssignment.findFirst({
    where: { classId, subjectId, schoolYearId: year.id },
    select: { id: true, teacherId: true },
  });
  if (existing && existing.teacherId !== teacherId) {
    return { error: "alreadyAssigned" };
  }
  if (existing) return { ok: true };

  const created = await prisma.teacherAssignment.create({
    data: { teacherId, classId, subjectId, schoolYearId: year.id },
  });

  await audit({
    actorId: actor.id,
    action: "ASSIGNMENT_CREATE",
    entity: "TeacherAssignment",
    entityId: created.id,
    after: created,
  });

  revalidatePath("/[locale]/(dashboard)/director/staff", "page");
  return { ok: true };
}

export async function removeAssignment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };

  await prisma.teacherAssignment.delete({ where: { id } });

  await audit({
    actorId: actor.id,
    action: "ASSIGNMENT_DELETE",
    entity: "TeacherAssignment",
    entityId: id,
  });

  revalidatePath("/[locale]/(dashboard)/director/staff", "page");
  return { ok: true };
}
