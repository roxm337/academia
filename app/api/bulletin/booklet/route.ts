import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/dal";
import { semesterById } from "@/lib/data/grades";
import { buildBulletinInputs } from "@/lib/data/bulletin";
import { canReadBooklet } from "@/lib/bulletin-access";
import { renderBulletinBooklet } from "@/lib/pdf/bulletin";

/**
 * Every bulletin for a class, in one bilingual PDF — one page per student, in
 * rank order. This is what a school actually does at the end of a semester;
 * downloading thirty separate files and collating them is the job it replaces.
 *
 * Staff only: a booklet exposes every classmate's marks and rank, so it is not
 * something a family may fetch even when their own child's results are public.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") === "ar" ? "ar" : "fr";
  const classId = url.searchParams.get("class") ?? "";
  const semesterId = url.searchParams.get("semester") ?? "";
  if (!classId || !semesterId) return new Response(null, { status: 400 });

  if (!(await canReadBooklet(user, classId))) return new Response(null, { status: 403 });

  const [semester, klass] = await Promise.all([
    semesterById(semesterId),
    prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
  ]);
  if (!semester || !klass) return new Response(null, { status: 404 });

  const inputs = await buildBulletinInputs({
    classId,
    className: klass.name,
    semesterId,
    locale,
  });
  if (inputs.length === 0) return new Response(null, { status: 404 });

  const pdf = await renderBulletinBooklet(inputs);
  const safeName = klass.name.replace(/[^\w.-]+/g, "-");

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bulletins-${safeName}-s${semester.index}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
