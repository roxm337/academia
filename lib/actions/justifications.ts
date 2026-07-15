"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifySession, assertParentOfStudent } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { dayStart, parseDay } from "@/lib/data/attendance";
import type { ActionState } from "@/lib/actions/structure";

const submitSchema = z.object({
  studentId: z.string().min(1),
  reason: z.string().trim().min(3).max(500),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
});

/**
 * A parent (for their child) or a student (for themselves) asks for an absence
 * to be excused. The student is authorized here from the session — never taken
 * on trust from the form — so no one can file against another child.
 */
export async function submitJustification(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  const parsed = submitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const { studentId, reason } = parsed.data;
  const from = parseDay(parsed.data.fromDate);
  const to = parseDay(parsed.data.toDate);
  if (!from || !to || to < from) return { error: "invalid" };

  if (actor.role === "PARENT") {
    try {
      await assertParentOfStudent(actor.id, studentId);
    } catch {
      return { error: "notAllowed" };
    }
  } else if (actor.role === "STUDENT") {
    const me = await prisma.studentProfile.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    });
    if (!me || me.id !== studentId) return { error: "notAllowed" };
  } else {
    return { error: "notAllowed" };
  }

  const created = await prisma.absenceJustification.create({
    data: { studentId, reason, fromDate: dayStart(from), toDate: dayStart(to) },
  });

  await audit({
    actorId: actor.id,
    action: "JUSTIFICATION_SUBMIT",
    entity: "AbsenceJustification",
    entityId: created.id,
    after: created,
  });

  revalidatePath("/[locale]/(dashboard)/parent/attendance", "page");
  revalidatePath("/[locale]/(dashboard)/student/attendance", "page");
  revalidatePath("/[locale]/(dashboard)/surveillant/justifications", "page");
  return { ok: true };
}

const reviewSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  reviewNote: z.string().trim().max(500).optional(),
});

/**
 * A surveillant (or director) approves or rejects a request. Approving excuses
 * every ABSENT record the student has inside the requested window — which also
 * removes them from the unexcused count that drives absence alerts.
 */
export async function reviewJustification(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await verifySession();
  if (actor.role !== "SURVEILLANT" && actor.role !== "DIRECTOR") {
    return { error: "notAllowed" };
  }

  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const { id, decision, reviewNote } = parsed.data;

  const justification = await prisma.absenceJustification.findUnique({
    where: { id },
  });
  if (!justification) return { error: "notFound" };
  if (justification.status !== "PENDING") return { error: "alreadyReviewed" };

  const approved = decision === "APPROVE";

  await prisma.$transaction(async (tx) => {
    await tx.absenceJustification.update({
      where: { id },
      data: {
        status: approved ? "APPROVED" : "REJECTED",
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
    });

    if (approved) {
      await tx.attendanceRecord.updateMany({
        where: {
          studentId: justification.studentId,
          status: "ABSENT",
          session: {
            date: { gte: justification.fromDate, lte: justification.toDate },
          },
        },
        data: { isExcused: true, justificationId: id },
      });
    }
  });

  // Tell the student's guardians the outcome.
  const student = await prisma.studentProfile.findUnique({
    where: { id: justification.studentId },
    select: { guardians: { select: { guardian: { select: { userId: true } } } } },
  });
  const guardianUserIds = (student?.guardians ?? [])
    .map((g) => g.guardian.userId)
    .filter((x): x is string => Boolean(x));
  if (guardianUserIds.length) {
    await notifyMany(guardianUserIds, {
      type: "JUSTIFICATION_REVIEWED",
      titleAr: "مراجعة طلب التبرير",
      titleFr: "Justificatif traité",
      bodyAr: approved ? "تمت الموافقة على طلب التبرير." : "تم رفض طلب التبرير.",
      bodyFr: approved ? "Votre justificatif a été approuvé." : "Votre justificatif a été refusé.",
      link: "/parent/attendance",
    });
  }

  await audit({
    actorId: actor.id,
    action: approved ? "JUSTIFICATION_APPROVE" : "JUSTIFICATION_REJECT",
    entity: "AbsenceJustification",
    entityId: id,
    before: justification,
  });

  revalidatePath("/[locale]/(dashboard)/surveillant/justifications", "page");
  return { ok: true };
}
