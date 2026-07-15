import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { detectConflicts, type SlotShape } from "../lib/timetable";
import { renderTimetablePdf } from "../lib/pdf/timetable";

/**
 * Milestone 3 acceptance: the timetable's conflict detection actually blocks a
 * double-booked teacher or room, against real rows in the database — and a
 * class + teacher PDF renders. Runs entirely on seed data and cleans up the
 * rows it inserts.
 *
 *   npx tsx --conditions=react-server scripts/acceptance-timetable.ts
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Existing NORMAL/RAMADAN slots for the year, in the shape the engine wants. */
async function existingSlots(schoolYearId: string, variant: "NORMAL" | "RAMADAN") {
  return prisma.timetableSlot.findMany({
    where: { schoolYearId, variant },
    select: {
      id: true, weekday: true, variant: true, startMin: true, endMin: true,
      classId: true, teacherId: true, roomId: true,
    },
  }) as Promise<SlotShape[]>;
}

async function main() {
  const year = await prisma.schoolYear.findFirst({ where: { isCurrent: true } });
  if (!year) throw new Error("seed the database first (no current school year)");

  const classes = await prisma.class.findMany({
    where: { schoolYearId: year.id },
    take: 2,
    select: { id: true, name: true },
  });
  const teachers = await prisma.teacherProfile.findMany({
    take: 2,
    select: { id: true },
  });
  const subjects = await prisma.subject.findMany({ take: 2, select: { id: true } });
  if (classes.length < 2 || teachers.length < 2 || subjects.length < 1) {
    throw new Error("seed must have ≥2 classes, ≥2 teachers, ≥1 subject");
  }

  // Ensure two rooms exist; create throwaways if the seed is thin.
  const seedRooms = await prisma.room.findMany({ take: 2, select: { id: true } });
  const tempRoomIds: string[] = [];
  const rooms = [...seedRooms];
  while (rooms.length < 2) {
    const r = await prisma.room.create({
      data: { name: `__accept_room_${rooms.length}_${year.id.slice(0, 6)}` },
    });
    rooms.push({ id: r.id });
    tempRoomIds.push(r.id);
  }

  const [C1, C2] = classes;
  const [T1, T2] = teachers;
  const S1 = subjects[0];
  const [R1, R2] = rooms;

  const createdIds: string[] = [];
  // Saturday 16:00–17:00 — a band the seed timetable leaves empty, so these
  // checks measure the engine, not a collision with seed data.
  const SLOT = { weekday: "SATURDAY" as const, startMin: 16 * 60, endMin: 17 * 60 };

  try {
    // --- Anchor lesson: class C1, teacher T1, room R1, Saturday 16:00–17:00.
    const anchor = await prisma.timetableSlot.create({
      data: {
        schoolYearId: year.id,
        classId: C1.id, subjectId: S1.id, teacherId: T1.id, roomId: R1.id,
        variant: "NORMAL", ...SLOT,
      },
    });
    createdIds.push(anchor.id);
    console.log(`· anchor placed: ${C1.name}, Saturday 16:00–17:00\n`);

    const base = (over: Partial<SlotShape>): SlotShape => ({
      weekday: "SATURDAY", variant: "NORMAL", startMin: 16 * 60, endMin: 17 * 60,
      classId: C2.id, teacherId: T2.id, roomId: R2.id, ...over,
    });

    // --- Teacher double-book: same teacher, other class/room, same slot.
    let existing = await existingSlots(year.id, "NORMAL");
    let c = detectConflicts(base({ teacherId: T1.id }), existing).map((x) => x.kind);
    check("teacher double-booked is blocked", c.includes("teacher"), `got [${c}]`);

    // --- Room double-book: same room, other teacher/class, same slot.
    c = detectConflicts(base({ roomId: R1.id }), existing).map((x) => x.kind);
    check("room double-booked is blocked", c.includes("room"), `got [${c}]`);

    // --- Class double-book: same class already busy that slot.
    c = detectConflicts(base({ classId: C1.id }), existing).map((x) => x.kind);
    check("class double-booked is blocked", c.includes("class"), `got [${c}]`);

    // --- Adjacent time for the SAME teacher: allowed (touching edges 17:00).
    c = detectConflicts(
      base({ teacherId: T1.id, startMin: 17 * 60, endMin: 18 * 60 }),
      existing,
    ).map((x) => x.kind);
    check("adjacent 17:00–18:00 for same teacher is allowed", c.length === 0, `got [${c}]`);

    // --- Same slot but RAMADAN variant: independent, allowed.
    const ramExisting = await existingSlots(year.id, "RAMADAN");
    c = detectConflicts(
      base({ teacherId: T1.id, roomId: R1.id, classId: C1.id, variant: "RAMADAN" }),
      ramExisting,
    ).map((x) => x.kind);
    check("same time in RAMADAN variant is allowed", c.length === 0, `got [${c}]`);

    // --- A genuinely free lesson persists and reads back.
    const freeCandidate = base({
      teacherId: T1.id, roomId: R2.id, startMin: 17 * 60, endMin: 18 * 60,
    });
    existing = await existingSlots(year.id, "NORMAL");
    if (detectConflicts(freeCandidate, existing).length === 0) {
      const placed = await prisma.timetableSlot.create({
        data: {
          schoolYearId: year.id,
          classId: freeCandidate.classId, subjectId: S1.id,
          teacherId: freeCandidate.teacherId, roomId: freeCandidate.roomId,
          variant: "NORMAL",
          weekday: freeCandidate.weekday,
          startMin: freeCandidate.startMin, endMin: freeCandidate.endMin,
        },
      });
      createdIds.push(placed.id);
    }
    const c1Slots = await prisma.timetableSlot.findMany({
      where: { classId: C1.id, variant: "NORMAL", schoolYearId: year.id },
    });
    check("anchor lesson reads back from the class grid", c1Slots.some((s) => s.id === anchor.id));

    // --- PDF renders for a class and for a teacher.
    const weekdayLabels = {
      MONDAY: "Lundi", TUESDAY: "Mardi", WEDNESDAY: "Mercredi", THURSDAY: "Jeudi",
      FRIDAY: "Vendredi", SATURDAY: "Samedi", SUNDAY: "Dimanche",
    };
    const withNames = await prisma.timetableSlot.findMany({
      where: { classId: C1.id, variant: "NORMAL", schoolYearId: year.id },
      include: { subject: true, teacher: { include: { user: true } }, room: true },
    });
    const pdf = await renderTimetablePdf({
      title: `Classe : ${C1.name}`,
      subtitle: `Année ${year.label} · Normal`,
      variant: "NORMAL",
      locale: "fr",
      timeLabel: "Heure",
      weekdayLabels,
      slots: withNames.map((s) => ({
        weekday: s.weekday,
        startMin: s.startMin,
        endMin: s.endMin,
        subject: s.subject.nameFr,
        secondary: `${s.teacher.user.firstNameFr} ${s.teacher.user.lastNameFr}`,
        room: s.room?.name ?? null,
      })),
    });
    const magic = Buffer.from(pdf.slice(0, 5)).toString("latin1");
    check("class PDF renders", magic === "%PDF-" && pdf.length > 1000, `${magic}, ${pdf.length} bytes`);

    // --- Arabic PDF (RTL + Amiri) renders too.
    const pdfAr = await renderTimetablePdf({
      title: "القسم", subtitle: "رمضان", variant: "RAMADAN", locale: "ar",
      timeLabel: "التوقيت",
      weekdayLabels: {
        MONDAY: "الاثنين", TUESDAY: "الثلاثاء", WEDNESDAY: "الأربعاء", THURSDAY: "الخميس",
        FRIDAY: "الجمعة", SATURDAY: "السبت", SUNDAY: "الأحد",
      },
      slots: [],
    });
    const magicAr = Buffer.from(pdfAr.slice(0, 5)).toString("latin1");
    check("Arabic (RTL) PDF renders", magicAr === "%PDF-" && pdfAr.length > 1000, `${magicAr}, ${pdfAr.length} bytes`);
  } finally {
    // Clean up everything this run created.
    if (createdIds.length) {
      await prisma.timetableSlot.deleteMany({ where: { id: { in: createdIds } } });
    }
    if (tempRoomIds.length) {
      await prisma.room.deleteMany({ where: { id: { in: tempRoomIds } } });
    }
  }

  console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: ${failures} failing check(s)`);
  if (failures > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
