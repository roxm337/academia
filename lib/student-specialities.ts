import "server-only";

import { prisma } from "@/lib/prisma";
import { currentYear } from "@/lib/data/structure";
import { validateSpecialityChoice, type SpecialityChoiceError } from "@/lib/specialities";

/**
 * The write behind the spécialité picker, as a plain module.
 *
 * Split out of the "use server" action so the acceptance script can drive the
 * real function — a "use server" module pulls in the Next router runtime and
 * dies under tsx. The action stays a thin wrapper: role check, audit, revalidate.
 *
 * Everything that decides validity is re-derived from the database: the level
 * (never the form), the count it requires, the spécialités it offers. The
 * caller supplies only the ticked ids.
 */
export type SetSpecialitiesResult =
  | { ok: true; before: string[]; after: string[] }
  | { ok: false; error: SpecialityChoiceError | "notEnrolled" | "noSchoolYear" };

export async function setSpecialities(
  studentId: string,
  chosen: string[],
): Promise<SetSpecialitiesResult> {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      enrollments: {
        where: { isActive: true },
        take: 1,
        select: { class: { select: { level: { select: { id: true, code: true } } } } },
      },
    },
  });
  const level = student?.enrollments[0]?.class.level;
  if (!level) return { ok: false, error: "notEnrolled" };

  const year = await currentYear();
  if (!year) return { ok: false, error: "noSchoolYear" };

  const offered = await prisma.speciality.findMany({
    where: { levelId: level.id },
    select: { id: true },
  });
  const valid = validateSpecialityChoice({
    levelCode: level.code,
    chosen,
    offeredIds: offered.map((o) => o.id),
  });
  if (!valid.ok) return { ok: false, error: valid.error };

  const before = (
    await prisma.studentSpeciality.findMany({
      where: { studentId, schoolYearId: year.id },
      select: { specialityId: true },
    })
  ).map((r) => r.specialityId);

  // Replace the whole year's choice atomically: the set is small and always
  // written as a unit, so delete-then-create is simpler than diffing and cannot
  // leave a half-updated combination behind.
  await prisma.$transaction([
    prisma.studentSpeciality.deleteMany({ where: { studentId, schoolYearId: year.id } }),
    prisma.studentSpeciality.createMany({
      data: chosen.map((specialityId) => ({ studentId, specialityId, schoolYearId: year.id })),
    }),
  ]);

  return { ok: true, before, after: chosen };
}
