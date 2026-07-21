import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  buildInstallmentPlan, allocate, installmentStatus, scheduleSummary,
  monthsBetween, type FeeItemLike,
} from "../lib/fees";
import { renderReceiptPdf } from "../lib/pdf/receipt";

/**
 * Milestone 8 acceptance, against real database rows:
 *   - generating a schedule from an inscription (one-off) + tuition (monthly)
 *     produces 1 + N installments summing to the right gross;
 *   - a payment allocates oldest-first, updates installment status, and mints a
 *     sequential receipt that renders as PDF;
 *   - a discount reduces the net and the balance.
 * Creates its own fee items + schedule and cleans them up.
 *   npx tsx scripts/acceptance-fees.ts
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const year = await prisma.schoolYear.findFirst({ where: { isCurrent: true } });
  if (!year) throw new Error("seed the database first");
  const anyEnrollment = await prisma.enrollment.findFirst({
    where: { isActive: true },
    select: { classId: true, class: { select: { levelId: true } } },
  });
  if (!anyEnrollment) throw new Error("no active enrolment");
  const levelId = anyEnrollment.class.levelId;

  // A throwaway student rather than a seeded one: FeeSchedule is unique per
  // (student, year), so reusing a real pupil either collides with the schedule
  // the seed gave them or destroys it on cleanup.
  const tempUser = await prisma.user.create({
    data: {
      email: `__accept_fees_${Date.now()}@planetemontessori.demo`,
      passwordHash: "x", role: "STUDENT",
      firstNameAr: "اختبار", lastNameAr: "اختبار",
      firstNameFr: "Test", lastNameFr: "Fees",
      studentProfile: {
        create: {
          codeMassar: `Z${String(Date.now()).slice(-9)}`,
          birthDate: new Date("2010-01-01"),
          enrollments: { create: { classId: anyEnrollment.classId } },
        },
      },
    },
    include: { studentProfile: true },
  });
  const studentId = tempUser.studentProfile!.id;
  const director = await prisma.user.findFirst({ where: { role: "DIRECTOR" }, select: { id: true } });

  const months = monthsBetween(year.startDate, year.endDate).length;
  const feeItemIds: string[] = [];
  let scheduleId: string | null = null;

  try {
    const inscription = await prisma.feeItem.create({
      data: { schoolYearId: year.id, levelId, kind: "INSCRIPTION", nameAr: "تسجيل", nameFr: "Inscription", amount: 500, isMonthly: false },
    });
    const tuition = await prisma.feeItem.create({
      data: { schoolYearId: year.id, levelId, kind: "TUITION", nameAr: "شهري", nameFr: "Mensualité", amount: 900, isMonthly: true },
    });
    feeItemIds.push(inscription.id, tuition.id);

    // --- Generate schedule (mirrors the generateFor action) ------------------
    const feeItems: FeeItemLike[] = [inscription, tuition].map((i) => ({ id: i.id, isMonthly: i.isMonthly, amount: Number(i.amount), nameAr: i.nameAr, nameFr: i.nameFr }));
    const monthly = new Map(feeItems.map((i) => [i.id, i.isMonthly]));
    const plan = buildInstallmentPlan(feeItems, year.startDate, year.endDate);
    const now = new Date();
    const schedule = await prisma.feeSchedule.create({
      data: {
        studentId, schoolYearId: year.id,
        installments: { create: plan.map((p) => ({ feeItemId: p.feeItemId, label: monthly.get(p.feeItemId) ? p.dueDate.toISOString().slice(0, 7) : "", dueDate: p.dueDate, amount: p.amount, status: installmentStatus(p.amount, 0, p.dueDate, now) })) },
      },
      include: { installments: { orderBy: { dueDate: "asc" } } },
    });
    scheduleId = schedule.id;

    const expectedGross = 500 + 900 * months;
    check(`schedule has 1 + ${months} installments`, schedule.installments.length === 1 + months, `got ${schedule.installments.length}`);
    const gross = schedule.installments.reduce((a, i) => a + Number(i.amount), 0);
    check("gross equals inscription + tuition×months", gross === expectedGross, `${gross} vs ${expectedGross}`);

    // --- Record a payment of 1400: pays inscription (500) + first month (900) -
    const payAmount = 1400;
    const allocations = allocate(payAmount, schedule.installments.map((i) => ({ id: i.id, amount: Number(i.amount), amountPaid: Number(i.amountPaid) })));
    check("payment allocates across two installments oldest-first", allocations.length === 2 && allocations[0].amount === 500 && allocations[1].amount === 900, JSON.stringify(allocations.map((a) => a.amount)));

    const prevMax = (await prisma.receipt.findFirst({ orderBy: { number: "desc" }, select: { number: true } }))?.number ?? 0;
    const receiptNumber = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data: { feeScheduleId: schedule.id, studentId, amount: payAmount, method: "CASH", recordedById: director!.id } });
      for (const a of allocations) {
        await tx.paymentAllocation.create({ data: { paymentId: payment.id, installmentId: a.installmentId, amount: a.amount } });
        const inst = schedule.installments.find((i) => i.id === a.installmentId)!;
        const newPaid = Number(inst.amountPaid) + a.amount;
        await tx.installment.update({ where: { id: a.installmentId }, data: { amountPaid: newPaid, status: installmentStatus(Number(inst.amount), newPaid, inst.dueDate, now) } });
      }
      const number = prevMax + 1;
      await tx.receipt.create({ data: { paymentId: payment.id, number } });
      return number;
    });
    check("receipt number is sequential (prevMax + 1)", receiptNumber === prevMax + 1, `${receiptNumber} vs ${prevMax + 1}`);

    const inscInst = await prisma.installment.findFirst({ where: { feeScheduleId: schedule.id, feeItemId: inscription.id } });
    check("inscription installment is now PAID", inscInst?.status === "PAID", `${inscInst?.status}`);

    // --- Receipt PDF ---------------------------------------------------------
    const pdf = await renderReceiptPdf({
      locale: "ar", schoolName: "Planète Montessori", number: receiptNumber, issuedAt: now.toISOString().slice(0, 10),
      student: { name: "تلميذ", codeMassar: "A000000000" }, amount: payAmount, method: "نقداً", reference: null,
      allocations: allocations.map((a, i) => ({ label: i === 0 ? "تسجيل" : "شهري", amount: a.amount })),
      labels: { receipt: "وصل", number: "رقم", date: "التاريخ", student: "التلميذ", amount: "المبلغ", method: "الطريقة", reference: "المرجع", covers: "الأقساط", total: "المجموع" },
    });
    check("receipt renders as PDF", Buffer.from(pdf.slice(0, 5)).toString("latin1") === "%PDF-" && pdf.length > 1000);

    // --- Summary + discount --------------------------------------------------
    const payments = await prisma.payment.findMany({ where: { feeScheduleId: schedule.id }, select: { amount: true } });
    const noDisc = scheduleSummary(schedule.installments.map((i) => Number(i.amount)), 0, payments.map((p) => Number(p.amount)));
    check("balance = gross − paid with no discount", noDisc.balance === expectedGross - payAmount, `${noDisc.balance}`);

    await prisma.feeSchedule.update({ where: { id: schedule.id }, data: { siblingDiscount: 300 } });
    const withDisc = scheduleSummary(schedule.installments.map((i) => Number(i.amount)), 300, payments.map((p) => Number(p.amount)));
    check("a 300 discount reduces net and balance by 300", withDisc.net === expectedGross - 300 && withDisc.balance === expectedGross - 300 - payAmount, `net ${withDisc.net}, bal ${withDisc.balance}`);
  } finally {
    if (scheduleId) await prisma.feeSchedule.delete({ where: { id: scheduleId } }); // cascades installments, payments, allocations, receipts
    if (feeItemIds.length) await prisma.feeItem.deleteMany({ where: { id: { in: feeItemIds } } });
    await prisma.user.delete({ where: { id: tempUser.id } }); // cascades the profile and its enrolment
  }

  console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${failures} failing check(s)`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
