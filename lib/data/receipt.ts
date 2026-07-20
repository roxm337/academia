import "server-only";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings, schoolName as localizedSchool } from "@/lib/school";
import type { ReceiptInput } from "@/lib/pdf/receipt";

/**
 * Assembles printable receipts.
 *
 * Single receipt and batch booklet both come through here, so what a receipt
 * says can't change for one and not the other.
 */
export async function buildReceiptInputs(opts: {
  receiptIds: string[];
  locale: string;
}): Promise<ReceiptInput[]> {
  const { receiptIds, locale } = opts;
  if (receiptIds.length === 0) return [];

  const [receipts, t, settings] = await Promise.all([
    prisma.receipt.findMany({
      where: { id: { in: receiptIds } },
      include: {
        payment: {
          include: {
            student: {
              select: {
                codeMassar: true,
                user: {
                  select: {
                    firstNameAr: true,
                    lastNameAr: true,
                    firstNameFr: true,
                    lastNameFr: true,
                  },
                },
              },
            },
            allocations: { include: { installment: { include: { feeItem: true } } } },
          },
        },
      },
      // Receipt numbers are sequential, so this is also issue order.
      orderBy: { number: "asc" },
    }),
    getTranslations({ locale, namespace: "fees" }),
    getSchoolSettings(),
  ]);

  const arabic = locale === "ar";

  return receipts.map((receipt) => {
    const u = receipt.payment.student.user;
    return {
      locale,
      schoolName: localizedSchool(settings, locale),
      number: receipt.number,
      issuedAt: receipt.issuedAt.toISOString().slice(0, 10),
      student: {
        name: arabic ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`,
        codeMassar: receipt.payment.student.codeMassar,
      },
      amount: Number(receipt.payment.amount),
      method: t(`methods.${receipt.payment.method}`),
      reference: receipt.payment.reference,
      allocations: receipt.payment.allocations.map((a) => ({
        label: `${arabic ? a.installment.feeItem.nameAr : a.installment.feeItem.nameFr}${
          a.installment.label ? ` — ${a.installment.label}` : ""
        }`,
        amount: Number(a.amount),
      })),
      labels: {
        receipt: t("receipt"),
        number: t("receiptNo"),
        date: t("date"),
        student: t("student"),
        amount: t("amount"),
        method: t("method"),
        reference: t("reference"),
        covers: t("covers"),
        total: t("total"),
      },
    };
  });
}

/**
 * Receipts issued in a date range, optionally for one class.
 *
 * Bounded deliberately: "every receipt ever" would be an unbounded PDF, and a
 * school batches by month.
 */
export async function receiptIdsFor(opts: {
  from: Date;
  to: Date;
  classId?: string;
}): Promise<string[]> {
  const rows = await prisma.receipt.findMany({
    where: {
      issuedAt: { gte: opts.from, lte: opts.to },
      ...(opts.classId
        ? {
            payment: {
              student: {
                enrollments: { some: { classId: opts.classId, isActive: true } },
              },
            },
          }
        : {}),
    },
    select: { id: true },
    orderBy: { number: "asc" },
  });
  return rows.map((r) => r.id);
}
