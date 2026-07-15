import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { currentYear } from "@/lib/data/structure";
import { scheduleSummary, installmentStatus } from "@/lib/fees";

/** Every fee item for the active year, level-tagged. */
export const listFeeItems = cache(async () => {
  const year = await currentYear();
  if (!year) return [];
  return prisma.feeItem.findMany({
    where: { schoolYearId: year.id },
    include: { level: true },
    orderBy: [{ kind: "asc" }, { nameFr: "asc" }],
  });
});

/** Fee items that apply to a level: the level's own plus school-wide ones. */
export const applicableFeeItems = cache(async (levelId: string) => {
  const year = await currentYear();
  if (!year) return [];
  return prisma.feeItem.findMany({
    where: { schoolYearId: year.id, OR: [{ levelId }, { levelId: null }] },
    orderBy: { kind: "asc" },
  });
});

const scheduleInclude = {
  installments: { include: { feeItem: true }, orderBy: { dueDate: "asc" } },
  payments: { include: { receipt: true }, orderBy: { paidAt: "desc" } },
} as const;

/** One student's schedule for the active year, decorated with status + totals. */
export const studentSchedule = cache(async (studentId: string) => {
  const year = await currentYear();
  if (!year) return null;

  const schedule = await prisma.feeSchedule.findUnique({
    where: { studentId_schoolYearId: { studentId, schoolYearId: year.id } },
    include: scheduleInclude,
  });
  if (!schedule) return null;

  const today = new Date();
  const discount = Number(schedule.siblingDiscount) + Number(schedule.customDiscount);
  const installments = schedule.installments.map((i) => ({
    ...i,
    amountNum: Number(i.amount),
    amountPaidNum: Number(i.amountPaid),
    computedStatus: installmentStatus(Number(i.amount), Number(i.amountPaid), i.dueDate, today),
  }));
  const summary = scheduleSummary(
    installments.map((i) => i.amountNum),
    discount,
    schedule.payments.map((p) => Number(p.amount)),
  );

  return { schedule, installments, payments: schedule.payments, summary, discount };
});

/** Balance line per active student in a class (director overview). */
export const classFeeOverview = cache(async (classId: string) => {
  const year = await currentYear();
  if (!year) return [];

  const enrollments = await prisma.enrollment.findMany({
    where: { classId, isActive: true },
    select: {
      student: {
        select: {
          id: true, codeMassar: true,
          user: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true } },
          feeSchedules: {
            where: { schoolYearId: year.id },
            include: { installments: { select: { amount: true } }, payments: { select: { amount: true } } },
          },
        },
      },
    },
  });

  return enrollments.map((e) => {
    const s = e.student;
    const sched = s.feeSchedules[0] ?? null;
    const discount = sched ? Number(sched.siblingDiscount) + Number(sched.customDiscount) : 0;
    const summary = sched
      ? scheduleSummary(
          sched.installments.map((i) => Number(i.amount)),
          discount,
          sched.payments.map((p) => Number(p.amount)),
        )
      : null;
    return { student: s, hasSchedule: Boolean(sched), summary };
  });
});

/** A receipt with everything a PDF needs. */
export const receiptById = cache(async (receiptId: string) =>
  prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        include: {
          student: { select: { codeMassar: true, user: { select: { firstNameAr: true, lastNameAr: true, firstNameFr: true, lastNameFr: true } } } },
          allocations: { include: { installment: { include: { feeItem: true } } } },
        },
      },
    },
  }),
);

/** Overdue + soon-due installments, for the reminders view. */
export const dueSoonOrOverdue = cache(async () => {
  const year = await currentYear();
  if (!year) return [];
  const soon = new Date();
  soon.setUTCDate(soon.getUTCDate() + 7);

  return prisma.installment.findMany({
    where: {
      feeSchedule: { schoolYearId: year.id },
      status: { not: "PAID" },
      dueDate: { lte: soon },
    },
    include: {
      feeSchedule: {
        include: {
          student: { select: { id: true, codeMassar: true, user: { select: { firstNameFr: true, lastNameFr: true, firstNameAr: true, lastNameAr: true } } } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 500,
  });
});
