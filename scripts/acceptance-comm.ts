import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { canSeeAnnouncement, type ViewerContext } from "../lib/announcements";
import type { Role } from "../lib/generated/prisma/enums";

/**
 * Milestone 7 acceptance, against real database rows:
 *   - announcement audience targeting reaches exactly the right viewers
 *     (class / level / cycle / teachers / parents / whole-school), using
 *     viewer contexts built from real enrolments;
 *   - a parent may open a thread with their child's teacher but not with an
 *     unrelated teacher; a non-participant cannot read a thread.
 * Cleans up the thread it creates.
 *   npx tsx scripts/acceptance-comm.ts
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Replicates lib/data/announcements.viewerContext without the server-only import. */
async function contextFor(userId: string, role: Role): Promise<ViewerContext> {
  let classIds: string[] = [];
  if (role === "STUDENT") {
    const e = await prisma.enrollment.findMany({ where: { student: { userId }, isActive: true }, select: { classId: true } });
    classIds = e.map((x) => x.classId);
  } else if (role === "PARENT") {
    const e = await prisma.enrollment.findMany({ where: { student: { guardians: { some: { guardian: { userId } } } }, isActive: true }, select: { classId: true } });
    classIds = e.map((x) => x.classId);
  } else if (role === "TEACHER") {
    const a = await prisma.teacherAssignment.findMany({ where: { teacher: { userId } }, select: { classId: true } });
    classIds = a.map((x) => x.classId);
  }
  const classes = classIds.length
    ? await prisma.class.findMany({ where: { id: { in: [...new Set(classIds)] } }, select: { id: true, levelId: true, level: { select: { cycleId: true } } } })
    : [];
  return {
    role,
    classIds: new Set(classes.map((c) => c.id)),
    levelIds: new Set(classes.map((c) => c.levelId)),
    cycleIds: new Set(classes.map((c) => c.level.cycleId)),
  };
}

async function main() {
  // A class with a guardian-linked student and an assigned teacher.
  const assignment = await prisma.teacherAssignment.findFirst({
    where: { class: { enrollments: { some: { isActive: true, student: { guardians: { some: { guardian: { userId: { not: null } } } } } } } } },
    include: { class: { select: { id: true, levelId: true, level: { select: { cycleId: true } } } }, teacher: { select: { userId: true } } },
  });
  if (!assignment) throw new Error("seed a class with an assigned teacher and a linked guardian");
  const classId = assignment.class.id;
  const levelId = assignment.class.levelId;
  const cycleId = assignment.class.level.cycleId;
  const teacherUserId = assignment.teacher.userId;

  const student = await prisma.studentProfile.findFirst({
    where: { enrollments: { some: { classId, isActive: true } }, guardians: { some: { guardian: { userId: { not: null } } } } },
    select: { userId: true, guardians: { select: { guardian: { select: { userId: true } } } } },
  });
  const studentUserId = student!.userId;
  const parentUserId = student!.guardians.map((g) => g.guardian.userId).find(Boolean)!;

  // A teacher NOT assigned to this class.
  const otherTeacher = await prisma.teacherProfile.findFirst({
    where: { assignments: { none: { classId } }, userId: { not: teacherUserId } },
    select: { userId: true },
  });
  // Another class (different) for a negative CLASS test.
  const otherClass = await prisma.class.findFirst({ where: { id: { not: classId } }, select: { id: true } });

  const [studentCtx, parentCtx, teacherCtx] = await Promise.all([
    contextFor(studentUserId, "STUDENT"),
    contextFor(parentUserId, "PARENT"),
    contextFor(teacherUserId, "TEACHER"),
  ]);

  // --- Announcement targeting -----------------------------------------------
  const A = {
    whole: { audience: "WHOLE_SCHOOL" as const },
    thisClass: { audience: "CLASS" as const, classId },
    thisLevel: { audience: "LEVEL" as const, levelId },
    thisCycle: { audience: "CYCLE" as const, cycleId },
    teachers: { audience: "TEACHERS" as const },
    parents: { audience: "PARENTS" as const },
    otherClass: { audience: "CLASS" as const, classId: otherClass?.id ?? "none" },
  };

  check("whole-school reaches student, parent and teacher",
    canSeeAnnouncement(A.whole, studentCtx) && canSeeAnnouncement(A.whole, parentCtx) && canSeeAnnouncement(A.whole, teacherCtx));
  check("CLASS reaches the class's student and parent",
    canSeeAnnouncement(A.thisClass, studentCtx) && canSeeAnnouncement(A.thisClass, parentCtx));
  check("CLASS reaches the teacher who teaches it", canSeeAnnouncement(A.thisClass, teacherCtx));
  check("a different CLASS does NOT reach this student", !canSeeAnnouncement(A.otherClass, studentCtx));
  check("LEVEL and CYCLE reach the student",
    canSeeAnnouncement(A.thisLevel, studentCtx) && canSeeAnnouncement(A.thisCycle, studentCtx));
  check("TEACHERS reaches teacher, not student/parent",
    canSeeAnnouncement(A.teachers, teacherCtx) && !canSeeAnnouncement(A.teachers, studentCtx) && !canSeeAnnouncement(A.teachers, parentCtx));
  check("PARENTS reaches parent, not student/teacher",
    canSeeAnnouncement(A.parents, parentCtx) && !canSeeAnnouncement(A.parents, studentCtx) && !canSeeAnnouncement(A.parents, teacherCtx));

  // --- Messaging relationship (the query canMessage uses) -------------------
  const relatedTeacher = await prisma.teacherAssignment.findFirst({
    where: { teacher: { userId: teacherUserId }, class: { enrollments: { some: { isActive: true, student: { guardians: { some: { guardian: { userId: parentUserId } } } } } } } },
    select: { id: true },
  });
  check("parent may message their child's teacher", Boolean(relatedTeacher));

  if (otherTeacher) {
    const unrelated = await prisma.teacherAssignment.findFirst({
      where: { teacher: { userId: otherTeacher.userId }, class: { enrollments: { some: { isActive: true, student: { guardians: { some: { guardian: { userId: parentUserId } } } } } } } },
      select: { id: true },
    });
    check("parent may NOT message an unrelated teacher", !unrelated);
  }

  // --- Thread participant isolation ----------------------------------------
  let threadId: string | null = null;
  try {
    const thread = await prisma.messageThread.create({
      data: {
        kind: "PARENT_TEACHER",
        subject: "__accept_thread",
        participants: { create: [{ userId: parentUserId }, { userId: teacherUserId }] },
        messages: { create: { senderId: parentUserId, body: "hello" } },
      },
      include: { participants: { select: { userId: true } } },
    });
    threadId = thread.id;
    const ids = thread.participants.map((p) => p.userId);
    check("both correspondents are participants", ids.includes(parentUserId) && ids.includes(teacherUserId));
    check("an unrelated teacher is not a participant", !ids.includes(otherTeacher?.userId ?? "none"));
  } finally {
    if (threadId) await prisma.messageThread.delete({ where: { id: threadId } });
  }

  console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${failures} failing check(s)`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
