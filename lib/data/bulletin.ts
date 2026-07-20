import "server-only";

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings, schoolName as localizedSchool } from "@/lib/school";
import { currentYear } from "@/lib/data/structure";
import { computeClassResults, semesterById } from "@/lib/data/grades";
import { frozenResult } from "@/lib/data/council";
import type { BulletinInput, BulletinSubject } from "@/lib/pdf/bulletin";

/**
 * Assembles the printable bulletin for one or more students.
 *
 * Single bulletin and whole-class booklet both come through here, so a change
 * to what a bulletin says can't apply to one and miss the other.
 */
export async function buildBulletinInputs(opts: {
  classId: string;
  className: string;
  semesterId: string;
  locale: string;
  /** Restrict to these students; omit for the whole class, in rank order. */
  studentIds?: string[];
}): Promise<BulletinInput[]> {
  const { classId, className, semesterId, locale } = opts;

  const [semester, live, settings, year, t] = await Promise.all([
    semesterById(semesterId),
    computeClassResults(classId, semesterId),
    getSchoolSettings(),
    currentYear(),
    getTranslations({ locale, namespace: "grades" }),
  ]);
  if (!semester) return [];

  const wanted = opts.studentIds ? new Set(opts.studentIds) : null;
  const students = live.students
    .filter((s) => !wanted || wanted.has(s.studentId))
    // Rank order: the sequence the printed stack is handed out in.
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
  if (students.length === 0) return [];

  const ids = students.map((s) => s.studentId);
  const [frozenRows, appreciations, profiles] = await Promise.all([
    Promise.all(ids.map((id) => frozenResult(id, semesterId))),
    prisma.subjectAppreciation.findMany({
      where: { studentId: { in: ids }, semesterId },
      select: { studentId: true, subjectId: true, text: true },
    }),
    prisma.studentProfile.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        user: {
          select: {
            firstNameAr: true,
            lastNameAr: true,
            firstNameFr: true,
            lastNameFr: true,
          },
        },
      },
    }),
  ]);

  const frozenById = new Map(ids.map((id, i) => [id, frozenRows[i]]));
  const nameById = new Map(profiles.map((p) => [p.id, p.user]));
  const apprByStudent = new Map<string, Map<string, string>>();
  for (const a of appreciations) {
    const forStudent = apprByStudent.get(a.studentId) ?? new Map<string, string>();
    forStudent.set(a.subjectId, a.text);
    apprByStudent.set(a.studentId, forStudent);
  }

  const arabic = locale === "ar";
  const labels = {
    bulletin: t("bulletin"),
    subject: t("selectSubject"),
    coefficient: t("coefficient"),
    average: t("average"),
    appreciation: t("appreciation"),
    generalAverage: t("generalAverage"),
    rank: t("rank"),
    mention: t("mention"),
    classAverage: t("classAverage"),
    min: t("min"),
    max: t("max"),
    notGraded: t("notGraded"),
    of: t("of"),
    councilDecision: t("council.decision"),
    directorAppreciation: t("council.directorAppreciation"),
  };

  return students.map((s) => {
    const frozen = frozenById.get(s.studentId) ?? null;
    const user = nameById.get(s.studentId);

    // A finalised semester is served from its archive: reprinting a February
    // bulletin in July must give February's numbers, even though the roster —
    // and so every rank — may have moved since.
    const subjects: BulletinSubject[] = frozen
      ? frozen.snapshot.subjectBreakdown.subjects.map((sub) => ({
          name: arabic ? sub.nameAr : sub.nameFr,
          coefficient: sub.coefficient,
          average: sub.average,
          appreciation: sub.appreciation ?? null,
        }))
      : s.subjects.map((sub) => ({
          name: arabic ? sub.nameAr : sub.nameFr,
          coefficient: sub.coefficient,
          average: sub.average,
          appreciation: apprByStudent.get(s.studentId)?.get(sub.subjectId) ?? null,
        }));

    const mention = frozen ? frozen.snapshot.mention : s.mention;

    return {
      locale,
      schoolName: localizedSchool(settings, locale),
      student: {
        name: user
          ? arabic
            ? `${user.firstNameAr} ${user.lastNameAr}`
            : `${user.firstNameFr} ${user.lastNameFr}`
          : "",
        codeMassar: s.codeMassar,
      },
      className,
      yearLabel: year?.label ?? "",
      semesterLabel: t("semesterN", { n: semester.index }),
      subjects,
      general: frozen ? frozen.snapshot.generalAverage : s.general,
      mention: mention ? t(`mentions.${mention}`) : "",
      rank: frozen ? frozen.snapshot.rank : s.rank,
      classSize: frozen ? frozen.snapshot.classSize : live.students.length,
      stats: frozen
        ? {
            average: frozen.snapshot.classAverage,
            min: frozen.snapshot.classMin,
            max: frozen.snapshot.classMax,
          }
        : live.stats,
      // Stored as a key, so it prints in the reader's language rather than
      // whichever one the director happened to be working in.
      councilDecision: frozen?.councilDecision
        ? t(`council.decisions.${frozen.councilDecision}`)
        : null,
      directorAppreciation: frozen?.directorAppreciation ?? null,
      labels,
    };
  });
}
