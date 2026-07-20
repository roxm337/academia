import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/dal";
import { semesterById } from "@/lib/data/grades";
import { buildBulletinInputs } from "@/lib/data/bulletin";
import { canReadBulletin } from "@/lib/bulletin-access";
import { renderBulletinPdf } from "@/lib/pdf/bulletin";
import { resolveLocale } from "@/i18n/routing";

/**
 * A student's bulletin, per semester, localized to the requested UI language.
 *
 * Route Handler = its own entry point, so authorization is re-derived here:
 * the director always; a teacher who teaches the student's class; the student
 * themselves or their parent — the latter two only once the semester's grades
 * are published.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const url = new URL(req.url);
  const locale = resolveLocale(url.searchParams.get("locale"));
  const studentId = url.searchParams.get("student") ?? "";
  const semesterId = url.searchParams.get("semester") ?? "";
  if (!studentId || !semesterId) return new Response(null, { status: 400 });

  const semester = await semesterById(semesterId);
  if (!semester) return new Response(null, { status: 404 });

  // The student's active class — the bulletin is scoped to it.
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, isActive: true },
    select: { classId: true, class: { select: { name: true } } },
  });
  if (!enrollment) return new Response(null, { status: 404 });

  const allowed = await canReadBulletin(
    user,
    studentId,
    enrollment.classId,
    Boolean(semester.gradesPublishedAt),
  );
  if (!allowed) return new Response(null, { status: 403 });

  const [input] = await buildBulletinInputs({
    classId: enrollment.classId,
    className: enrollment.class.name,
    semesterId,
    locale,
    studentIds: [studentId],
  });
  if (!input) return new Response(null, { status: 404 });

  const pdf = await renderBulletinPdf(input);

  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bulletin-${input.student.codeMassar}-s${semester.index}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
