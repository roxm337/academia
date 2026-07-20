"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { isValidCodeMassar, normalizeCodeMassar } from "@/lib/massar";
import { DOC_TYPES, IMAGE_TYPES, storeUpload } from "@/lib/storage";
import type { ActionState } from "@/lib/actions/structure";

/** State that can also hand back a one-time password for a new parent account. */
export type GuardianState =
  | (NonNullable<ActionState> & { tempPassword?: string; email?: string })
  | null;

const studentSchema = z.object({
  id: z.string().optional(),
  codeMassar: z.string().trim().min(1),
  cne: z.string().trim().optional(),
  firstNameAr: z.string().trim().min(1),
  lastNameAr: z.string().trim().min(1),
  firstNameFr: z.string().trim().min(1),
  lastNameFr: z.string().trim().min(1),
  birthDate: z.string().min(1),
  birthPlaceAr: z.string().trim().optional(),
  birthPlaceFr: z.string().trim().optional(),
  gender: z.enum(["M", "F"]).optional().or(z.literal("").transform(() => undefined)),
  classId: z.string().optional(),
});

export async function saveStudent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = studentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const d = parsed.data;
  const codeMassar = normalizeCodeMassar(d.codeMassar);
  if (!isValidCodeMassar(codeMassar)) {
    return { error: "invalid", fieldErrors: { codeMassar: "invalid.codeMassar" } };
  }

  const clash = await prisma.studentProfile.findFirst({
    where: { codeMassar, ...(d.id ? { NOT: { id: d.id } } : {}) },
    select: { id: true },
  });
  if (clash) return { error: "duplicateMassar" };

  const birthDate = new Date(d.birthDate);
  if (Number.isNaN(birthDate.getTime())) return { error: "invalid" };

  if (d.id) {
    const before = await prisma.studentProfile.findUnique({
      where: { id: d.id },
      include: { user: true },
    });
    if (!before) return { error: "notFound" };

    const updated = await prisma.studentProfile.update({
      where: { id: d.id },
      data: {
        codeMassar,
        cne: d.cne || null,
        birthDate,
        birthPlaceAr: d.birthPlaceAr || null,
        birthPlaceFr: d.birthPlaceFr || null,
        gender: d.gender ?? null,
        user: {
          update: {
            firstNameAr: d.firstNameAr,
            lastNameAr: d.lastNameAr,
            firstNameFr: d.firstNameFr,
            lastNameFr: d.lastNameFr,
          },
        },
      },
      include: { user: true },
    });

    await audit({
      actorId: actor.id,
      action: "STUDENT_UPDATE",
      entity: "StudentProfile",
      entityId: d.id,
      before,
      after: updated,
    });
  } else {
    // A student login is created alongside the record. The email is derived from
    // the Code Massar, which is unique by definition — schools rarely have a real
    // address for every pupil.
    const email = `${codeMassar.toLowerCase()}@eleve.planetemontessori.demo`;
    const passwordHash = await bcrypt.hash(randomBytes(9).toString("base64url"), 10);

    const created = await prisma.studentProfile.create({
      data: {
        codeMassar,
        cne: d.cne || null,
        birthDate,
        birthPlaceAr: d.birthPlaceAr || null,
        birthPlaceFr: d.birthPlaceFr || null,
        gender: d.gender ?? null,
        user: {
          create: {
            email,
            passwordHash,
            role: "STUDENT",
            locale: "ar",
            firstNameAr: d.firstNameAr,
            lastNameAr: d.lastNameAr,
            firstNameFr: d.firstNameFr,
            lastNameFr: d.lastNameFr,
          },
        },
        ...(d.classId
          ? { enrollments: { create: { classId: d.classId } } }
          : {}),
      },
    });

    await audit({
      actorId: actor.id,
      action: "STUDENT_CREATE",
      entity: "StudentProfile",
      entityId: created.id,
      after: created,
    });
  }

  revalidatePath("/[locale]/(dashboard)/director/students", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- enrolment

const transferSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
});

/**
 * Moves a student to another class. The previous enrolment is closed rather
 * than deleted — attendance and grades already point at it.
 */
export async function transferStudent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = transferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const { studentId, classId } = parsed.data;

  const current = await prisma.enrollment.findFirst({
    where: { studentId, isActive: true },
  });
  if (current?.classId === classId) return { ok: true };

  await prisma.$transaction(async (tx) => {
    if (current) {
      await tx.enrollment.update({
        where: { id: current.id },
        data: { isActive: false, leftAt: new Date() },
      });
    }
    // The same student may return to a class they already left, so reuse the row.
    await tx.enrollment.upsert({
      where: { studentId_classId: { studentId, classId } },
      create: { studentId, classId },
      update: { isActive: true, leftAt: null, enrolledAt: new Date() },
    });
  });

  await audit({
    actorId: actor.id,
    action: "STUDENT_TRANSFER",
    entity: "StudentProfile",
    entityId: studentId,
    before: { classId: current?.classId ?? null },
    after: { classId },
  });

  revalidatePath("/[locale]/(dashboard)/director/students", "page");
  return { ok: true };
}

export async function setStudentStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["ACTIVE", "ARCHIVED", "TRANSFERRED", "GRADUATED"].includes(status)) {
    return { error: "invalid" };
  }

  const before = await prisma.studentProfile.findUnique({ where: { id } });
  if (!before) return { error: "notFound" };

  await prisma.$transaction(async (tx) => {
    await tx.studentProfile.update({
      where: { id },
      data: { status: status as "ACTIVE" },
    });
    // An archived student must not keep occupying a seat, and must not be able
    // to log in.
    if (status !== "ACTIVE") {
      await tx.enrollment.updateMany({
        where: { studentId: id, isActive: true },
        data: { isActive: false, leftAt: new Date() },
      });
      await tx.user.update({
        where: { id: before.userId },
        data: { isActive: false },
      });
    } else {
      await tx.user.update({
        where: { id: before.userId },
        data: { isActive: true },
      });
    }
  });

  await audit({
    actorId: actor.id,
    action: "STUDENT_STATUS",
    entity: "StudentProfile",
    entityId: id,
    before: { status: before.status },
    after: { status },
  });

  revalidatePath("/[locale]/(dashboard)/director/students", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- guardians

const guardianSchema = z.object({
  studentId: z.string().min(1),
  firstNameAr: z.string().trim().min(1),
  lastNameAr: z.string().trim().min(1),
  firstNameFr: z.string().trim().min(1),
  lastNameFr: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().email().or(z.literal("")).optional(),
  relation: z.enum(["FATHER", "MOTHER", "TUTOR", "OTHER"]),
  isPrimary: z.coerce.boolean().optional(),
  createAccount: z.string().optional(),
});

/**
 * Attaches a guardian to a student, reusing an existing guardian when the phone
 * matches — that is how siblings end up under one parent account rather than
 * one account per child.
 */
export async function addGuardian(
  _prev: GuardianState,
  formData: FormData,
): Promise<GuardianState> {
  const actor = await requireRole("DIRECTOR");
  const raw = Object.fromEntries(formData);
  const parsed = guardianSchema.safeParse({
    ...raw,
    isPrimary: raw.isPrimary === "on",
  });
  if (!parsed.success) return { error: "invalid" };

  const d = parsed.data;
  const wantsAccount = raw.createAccount === "on";
  const email = d.email?.trim() || "";

  if (wantsAccount && !email) {
    return { error: "invalid", fieldErrors: { email: "required" } };
  }

  let guardian = await prisma.guardian.findFirst({
    where: { phone: d.phone },
  });

  let tempPassword: string | undefined;

  if (!guardian) {
    let userId: string | undefined;

    if (wantsAccount) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) return { error: "emailTaken" };

      // Shown once to the director, who passes it to the parent. Never stored.
      tempPassword = randomBytes(6).toString("base64url");
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(tempPassword, 10),
          role: "PARENT",
          locale: "fr",
          firstNameAr: d.firstNameAr,
          lastNameAr: d.lastNameAr,
          firstNameFr: d.firstNameFr,
          lastNameFr: d.lastNameFr,
          phone: d.phone,
        },
      });
      userId = user.id;
    }

    guardian = await prisma.guardian.create({
      data: {
        userId,
        firstNameAr: d.firstNameAr,
        lastNameAr: d.lastNameAr,
        firstNameFr: d.firstNameFr,
        lastNameFr: d.lastNameFr,
        phone: d.phone,
        email: email || null,
      },
    });
  }

  await prisma.studentGuardian.upsert({
    where: {
      studentId_guardianId: {
        studentId: d.studentId,
        guardianId: guardian.id,
      },
    },
    create: {
      studentId: d.studentId,
      guardianId: guardian.id,
      relation: d.relation,
      isPrimary: d.isPrimary ?? false,
    },
    update: { relation: d.relation, isPrimary: d.isPrimary ?? false },
  });

  await audit({
    actorId: actor.id,
    action: "GUARDIAN_LINK",
    entity: "StudentGuardian",
    entityId: `${d.studentId}:${guardian.id}`,
    after: { relation: d.relation, accountCreated: Boolean(tempPassword) },
  });

  revalidatePath("/[locale]/(dashboard)/director/students/[id]", "page");
  return { ok: true, tempPassword, email: tempPassword ? email : undefined };
}

export async function removeGuardian(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const studentId = String(formData.get("studentId") ?? "");
  const guardianId = String(formData.get("id") ?? "");
  if (!studentId || !guardianId) return { error: "invalid" };

  await prisma.studentGuardian.delete({
    where: { studentId_guardianId: { studentId, guardianId } },
  });

  await audit({
    actorId: actor.id,
    action: "GUARDIAN_UNLINK",
    entity: "StudentGuardian",
    entityId: `${studentId}:${guardianId}`,
  });

  revalidatePath("/[locale]/(dashboard)/director/students/[id]", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- files

export async function uploadStudentPhoto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const studentId = String(formData.get("studentId") ?? "");
  const file = formData.get("file");
  if (!studentId || !(file instanceof File)) return { error: "invalid" };

  const result = await storeUpload(file, {
    uploadedById: actor.id,
    folder: `students/${studentId}`,
    allowed: IMAGE_TYPES,
  });
  if (!result.ok) return { error: result.error };

  const stored = await prisma.storedFile.findUnique({
    where: { id: result.fileId },
    select: { path: true },
  });

  await prisma.studentProfile.update({
    where: { id: studentId },
    data: { photoPath: stored?.path },
  });

  revalidatePath("/[locale]/(dashboard)/director/students/[id]", "page");
  return { ok: true };
}

export async function uploadStudentDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const studentId = String(formData.get("studentId") ?? "");
  const kind = String(formData.get("kind") ?? "OTHER");
  const file = formData.get("file");
  if (!studentId || !(file instanceof File)) return { error: "invalid" };

  const result = await storeUpload(file, {
    uploadedById: actor.id,
    folder: `students/${studentId}`,
    allowed: DOC_TYPES,
  });
  if (!result.ok) return { error: result.error };

  await prisma.studentDocument.create({
    data: { studentId, fileId: result.fileId, kind },
  });

  await audit({
    actorId: actor.id,
    action: "STUDENT_DOCUMENT_ADD",
    entity: "StudentProfile",
    entityId: studentId,
    after: { kind },
  });

  revalidatePath("/[locale]/(dashboard)/director/students/[id]", "page");
  return { ok: true };
}
