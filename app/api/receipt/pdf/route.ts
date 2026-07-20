import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/dal";
import { receiptById } from "@/lib/data/fees";
import { buildReceiptInputs } from "@/lib/data/receipt";
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

  const [input] = await buildReceiptInputs({ receiptIds: [id], locale });
  if (!input) return new Response(null, { status: 404 });
  const pdf = await renderReceiptPdf(input);

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${receipt.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
