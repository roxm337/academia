import type { NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/dal";
import { getSchoolSettings, schoolName as localizedSchool } from "@/lib/school";
import { receiptById } from "@/lib/data/fees";
import { renderReceiptPdf } from "@/lib/pdf/receipt";

/**
 * A payment receipt as PDF. Role-aware: the director sees any; a parent only a
 * receipt for one of their own children. Re-checked here — a Route Handler has
 * no protection from the page that linked it.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "fr";
  const id = url.searchParams.get("id") ?? "";
  if (!id) return new Response(null, { status: 400 });

  const receipt = await receiptById(id);
  if (!receipt) return new Response(null, { status: 404 });
  const studentId = receipt.payment.studentId;

  let allowed = user.role === "DIRECTOR";
  if (!allowed && user.role === "PARENT") {
    allowed = Boolean(
      await prisma.studentGuardian.findFirst({
        where: { studentId, guardian: { userId: user.id } },
        select: { studentId: true },
      }),
    );
  }
  if (!allowed) return new Response(null, { status: 403 });

  const [t, settings] = await Promise.all([
    getTranslations({ locale, namespace: "fees" }),
    getSchoolSettings(),
  ]);

  const u = receipt.payment.student.user;
  const name = locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;

  const pdf = await renderReceiptPdf({
    locale,
    schoolName: localizedSchool(settings, locale),
    number: receipt.number,
    issuedAt: receipt.issuedAt.toISOString().slice(0, 10),
    student: { name, codeMassar: receipt.payment.student.codeMassar },
    amount: Number(receipt.payment.amount),
    method: t(`methods.${receipt.payment.method}`),
    reference: receipt.payment.reference,
    allocations: receipt.payment.allocations.map((a) => ({
      label: `${locale === "ar" ? a.installment.feeItem.nameAr : a.installment.feeItem.nameFr}${a.installment.label ? ` — ${a.installment.label}` : ""}`,
      amount: Number(a.amount),
    })),
    labels: {
      receipt: t("receipt"), number: t("receiptNo"), date: t("date"), student: t("student"),
      amount: t("amount"), method: t("method"), reference: t("reference"), covers: t("covers"), total: t("total"),
    },
  });

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${receipt.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
