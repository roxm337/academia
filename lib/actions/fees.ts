"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { currentYear } from "@/lib/data/structure";
import { applicableFeeItems } from "@/lib/data/fees";
import {
  buildInstallmentPlan,
  installmentStatus,
  allocate,
  formatMAD,
  type FeeItemLike,
} from "@/lib/fees";
import type { ActionState } from "@/lib/actions/structure";

const money = z.coerce.number().min(0).max(1_000_000);

// ---------------------------------------------------------------- fee items

const feeItemSchema = z.object({
  id: z.string().optional(),
  levelId: z.string().optional(),
  kind: z.enum(["INSCRIPTION", "TUITION", "TRANSPORT", "CANTINE", "INSURANCE", "BOOKS", "OTHER"]),
  nameAr: z.string().trim().min(1).max(120),
  nameFr: z.string().trim().min(1).max(120),
  amount: money,
  isMonthly: z.enum(["on"]).optional(),
});

export async function saveFeeItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const year = await currentYear();
  if (!year) return { error: "noSchoolYear" };
  const parsed = feeItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const data = {
    schoolYearId: year.id,
    levelId: d.levelId || null,
    kind: d.kind,
    nameAr: d.nameAr,
    nameFr: d.nameFr,
    amount: d.amount,
    isMonthly: d.isMonthly === "on",
  };
  const item = d.id
    ? await prisma.feeItem.update({ where: { id: d.id }, data })
    : await prisma.feeItem.create({ data });

  await audit({ actorId: actor.id, action: d.id ? "FEEITEM_UPDATE" : "FEEITEM_CREATE", entity: "FeeItem", entityId: item.id, after: item });
  revalidatePath("/[locale]/(dashboard)/director/fees", "page");
  return { ok: true };
}

export async function deleteFeeItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "invalid" };
  // Refuse if it has already produced installments — deleting would cascade them.
  const used = await prisma.installment.count({ where: { feeItemId: id } });
  if (used > 0) return { error: "feeItemInUse" };
  await prisma.feeItem.delete({ where: { id } });
  await audit({ actorId: actor.id, action: "FEEITEM_DELETE", entity: "FeeItem", entityId: id });
  revalidatePath("/[locale]/(dashboard)/director/fees", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- schedules

/** Build a student's schedule from their level's fee items. No-op if one exists. */
async function generateFor(studentId: string, yearId: string, yearStart: Date, yearEnd: Date): Promise<"created" | "exists" | "noClass"> {
  const existing = await prisma.feeSchedule.findUnique({
    where: { studentId_schoolYearId: { studentId, schoolYearId: yearId } },
    select: { id: true },
  });
  if (existing) return "exists";

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, isActive: true },
    select: { class: { select: { levelId: true } } },
  });
  if (!enrollment) return "noClass";

  const items = await applicableFeeItems(enrollment.class.levelId);
  if (items.length === 0) return "noClass";

  const feeItems: FeeItemLike[] = items.map((i) => ({
    id: i.id, isMonthly: i.isMonthly, amount: Number(i.amount), nameAr: i.nameAr, nameFr: i.nameFr,
  }));
  const monthly = new Map(items.map((i) => [i.id, i.isMonthly]));
  const plan = buildInstallmentPlan(feeItems, yearStart, yearEnd);
  const now = new Date();

  await prisma.feeSchedule.create({
    data: {
      studentId,
      schoolYearId: yearId,
      installments: {
        create: plan.map((p) => ({
          feeItemId: p.feeItemId,
          label: monthly.get(p.feeItemId) ? p.dueDate.toISOString().slice(0, 7) : "",
          dueDate: p.dueDate,
          amount: p.amount,
          status: installmentStatus(p.amount, 0, p.dueDate, now),
        })),
      },
    },
  });
  return "created";
}

export async function generateSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const year = await currentYear();
  if (!year) return { error: "noSchoolYear" };
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) return { error: "invalid" };

  const r = await generateFor(studentId, year.id, year.startDate, year.endDate);
  if (r === "noClass") return { error: "noSchedule" };

  await audit({ actorId: actor.id, action: "SCHEDULE_GENERATE", entity: "StudentProfile", entityId: studentId });
  revalidatePath("/[locale]/(dashboard)/director/fees", "page");
  return { ok: true };
}

export async function generateClassSchedules(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const year = await currentYear();
  if (!year) return { error: "noSchoolYear" };
  const classId = String(formData.get("classId") ?? "");
  if (!classId) return { error: "invalid" };

  const roster = await prisma.enrollment.findMany({ where: { classId, isActive: true }, select: { studentId: true } });
  let created = 0;
  for (const { studentId } of roster) {
    if ((await generateFor(studentId, year.id, year.startDate, year.endDate)) === "created") created++;
  }
  await audit({ actorId: actor.id, action: "SCHEDULE_GENERATE_CLASS", entity: "Class", entityId: classId, after: { created } });
  revalidatePath("/[locale]/(dashboard)/director/fees", "page");
  return { ok: true };
}

const discountSchema = z.object({
  scheduleId: z.string().min(1),
  siblingDiscount: money,
  customDiscount: money,
  discountNote: z.string().trim().max(200).optional(),
});

export async function setDiscount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = discountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;
  await prisma.feeSchedule.update({
    where: { id: d.scheduleId },
    data: { siblingDiscount: d.siblingDiscount, customDiscount: d.customDiscount, discountNote: d.discountNote || null },
  });
  await audit({ actorId: actor.id, action: "DISCOUNT_SET", entity: "FeeSchedule", entityId: d.scheduleId, after: d });
  revalidatePath("/[locale]/(dashboard)/director/fees", "page");
  return { ok: true };
}

// ---------------------------------------------------------------- payments

const paymentSchema = z.object({
  studentId: z.string().min(1),
  amount: z.coerce.number().positive().max(1_000_000),
  method: z.enum(["CASH", "CHECK", "TRANSFER"]),
  reference: z.string().trim().max(80).optional(),
  note: z.string().trim().max(200).optional(),
});

export async function recordPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const year = await currentYear();
  if (!year) return { error: "noSchoolYear" };
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const d = parsed.data;

  const schedule = await prisma.feeSchedule.findUnique({
    where: { studentId_schoolYearId: { studentId: d.studentId, schoolYearId: year.id } },
    include: { installments: { orderBy: { dueDate: "asc" } } },
  });
  if (!schedule) return { error: "noSchedule" };

  const allocations = allocate(
    d.amount,
    schedule.installments.map((i) => ({ id: i.id, amount: Number(i.amount), amountPaid: Number(i.amountPaid) })),
  );

  const now = new Date();
  const receiptNumber = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        feeScheduleId: schedule.id, studentId: d.studentId, amount: d.amount,
        method: d.method, reference: d.reference || null, note: d.note || null,
        recordedById: actor.id,
      },
    });

    for (const a of allocations) {
      await tx.paymentAllocation.create({ data: { paymentId: payment.id, installmentId: a.installmentId, amount: a.amount } });
      const inst = schedule.installments.find((i) => i.id === a.installmentId)!;
      const newPaid = Number(inst.amountPaid) + a.amount;
      await tx.installment.update({
        where: { id: a.installmentId },
        data: { amountPaid: newPaid, status: installmentStatus(Number(inst.amount), newPaid, inst.dueDate, now) },
      });
    }

    const last = await tx.receipt.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    await tx.receipt.create({ data: { paymentId: payment.id, number } });
    return number;
  });

  // Notify guardians a payment was recorded.
  const guardians = await prisma.studentGuardian.findMany({
    where: { studentId: d.studentId, guardian: { userId: { not: null } } },
    select: { guardian: { select: { userId: true } } },
  });
  const ids = guardians.map((g) => g.guardian.userId).filter((x): x is string => Boolean(x));
  if (ids.length) {
    await notifyMany(ids, {
      type: "PAYMENT_RECORDED",
      titleAr: "إشعار بالأداء", titleFr: "Paiement enregistré",
      bodyAr: `تم تسجيل أداء بقيمة ${formatMAD(d.amount, "ar")} (وصل رقم ${receiptNumber}).`,
      bodyFr: `Un paiement de ${formatMAD(d.amount, "fr")} a été enregistré (reçu n° ${receiptNumber}).`,
      link: "/parent/fees",
    });
  }

  await audit({ actorId: actor.id, action: "PAYMENT_CREATE", entity: "FeeSchedule", entityId: schedule.id, after: { amount: d.amount, receiptNumber } });
  revalidatePath("/[locale]/(dashboard)/director/fees", "page");
  return { ok: true };
}

/** Notify guardians of students with an overdue or soon-due installment. */
export async function sendReminders(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const year = await currentYear();
  if (!year) return { error: "noSchoolYear" };
  void formData;

  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 7);
  const installments = await prisma.installment.findMany({
    where: { feeSchedule: { schoolYearId: year.id }, status: { not: "PAID" }, dueDate: { lte: soon } },
    select: {
      feeSchedule: { select: { student: { select: { id: true, guardians: { select: { guardian: { select: { userId: true } } } } } } } },
    },
  });

  // One reminder per guardian, not per installment.
  const byUser = new Set<string>();
  for (const i of installments) {
    for (const g of i.feeSchedule.student.guardians) {
      if (g.guardian.userId) byUser.add(g.guardian.userId);
    }
  }
  for (const userId of byUser) {
    await notifyMany([userId], {
      type: "PAYMENT_DUE",
      titleAr: "تذكير بالأداء", titleFr: "Rappel de paiement",
      bodyAr: "لديكم قسط مستحق أو قريب الاستحقاق.", bodyFr: "Une échéance est due ou proche de l'échéance.",
      link: "/parent/fees",
    });
  }

  await audit({ actorId: actor.id, action: "REMINDERS_SEND", entity: "SchoolYear", entityId: year.id, after: { reminded: byUser.size } });
  revalidatePath("/[locale]/(dashboard)/director/fees", "page");
  return { ok: true };
}
