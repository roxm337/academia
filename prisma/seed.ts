import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  CycleKind,
  GuardianRelation,
  Role,
  Weekday,
} from "../lib/generated/prisma/enums";

// The seed runs outside Next, so it builds its own client rather than importing
// lib/prisma.ts (which is "server-only").
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_PASSWORD = "Passw0rd!";

/** Code Massar: one letter + 9 digits, e.g. A123456789 */
function codeMassar(n: number): string {
  return `${String.fromCharCode(65 + (n % 26))}${String(100000000 + n).slice(0, 9)}`;
}

const MALE_NAMES = [
  ["أحمد", "Ahmed"], ["محمد", "Mohammed"], ["يوسف", "Youssef"], ["عمر", "Omar"],
  ["مهدي", "Mehdi"], ["أيوب", "Ayoub"], ["إلياس", "Ilyas"], ["حمزة", "Hamza"],
  ["رضى", "Réda"], ["أنس", "Anas"], ["ياسين", "Yassine"], ["زكرياء", "Zakaria"],
];
const FEMALE_NAMES = [
  ["فاطمة الزهراء", "Fatima Zahra"], ["مريم", "Meryem"], ["سلمى", "Salma"],
  ["خديجة", "Khadija"], ["إيمان", "Imane"], ["سارة", "Sara"], ["نهيلة", "Nohaila"],
  ["هاجر", "Hajar"], ["أسماء", "Asmae"], ["شيماء", "Chaimae"], ["لينا", "Lina"],
  ["زينب", "Zineb"],
];
const FAMILY_NAMES = [
  ["بنعلي", "Benali"], ["العلوي", "Alaoui"], ["الإدريسي", "Idrissi"],
  ["بنجلون", "Benjelloun"], ["الطاهري", "Tahiri"], ["الفاسي", "Fassi"],
  ["الشرقاوي", "Charkaoui"], ["برادة", "Berrada"], ["السقاط", "Sqalli"],
  ["الحسني", "Hassani"], ["الزياني", "Ziani"], ["المرابط", "Mrabet"],
];

async function main() {
  console.log("· clearing existing data");
  // order matters: children first
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog","Attachment","StoredFile","Receipt","PaymentAllocation","Payment",
      "Installment","FeeSchedule","FeeItem","Notification","Message","ThreadParticipant",
      "MessageThread","AnnouncementRead","Announcement","HomeworkSubmission","Homework",
      "CahierEntry","SemesterResult","SubjectAppreciation","Grade","GradeItem",
      "DisciplineIncident","AbsenceJustification","AttendanceRecord","Session",
      "TimetableSlot","TeacherAssignment","Enrollment","StudentDocument","StudentGuardian",
      "Guardian","StudentProfile","TeacherSubject","TeacherProfile","User","Class","Room",
      "LevelSubject","Subject","Stream","Level","Cycle","Holiday","Semester",
      "SchoolSettings","SchoolYear"
    RESTART IDENTITY CASCADE;
  `);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---------------------------------------------------------------- school year
  console.log("· school year 2025-2026");
  const year = await prisma.schoolYear.create({
    data: {
      label: "2025-2026",
      startDate: new Date("2025-09-08"),
      endDate: new Date("2026-07-10"),
      isCurrent: true,
      // Ramadan 1447 ≈ 17 Feb – 19 Mar 2026 → alternate timetable window
      ramadanStart: new Date("2026-02-17"),
      ramadanEnd: new Date("2026-03-19"),
      semesters: {
        create: [
          { index: 1, startDate: new Date("2025-09-08"), endDate: new Date("2026-01-23") },
          { index: 2, startDate: new Date("2026-01-26"), endDate: new Date("2026-07-10") },
        ],
      },
      holidays: {
        create: [
          { nameAr: "عيد المسيرة الخضراء", nameFr: "Marche Verte", startDate: new Date("2025-11-06"), endDate: new Date("2025-11-06") },
          { nameAr: "عيد الاستقلال", nameFr: "Fête de l'Indépendance", startDate: new Date("2025-11-18"), endDate: new Date("2025-11-18") },
          { nameAr: "العطلة البينية الأولى", nameFr: "Vacances intermédiaires 1", startDate: new Date("2025-10-26"), endDate: new Date("2025-11-02") },
          { nameAr: "عطلة نصف السنة", nameFr: "Vacances de mi-année", startDate: new Date("2026-01-24"), endDate: new Date("2026-02-01") },
          { nameAr: "عيد الفطر", nameFr: "Aïd Al-Fitr", startDate: new Date("2026-03-20"), endDate: new Date("2026-03-22") },
          { nameAr: "عيد الشغل", nameFr: "Fête du Travail", startDate: new Date("2026-05-01"), endDate: new Date("2026-05-01") },
          { nameAr: "عيد العرش", nameFr: "Fête du Trône", startDate: new Date("2026-07-30"), endDate: new Date("2026-07-30") },
        ],
      },
    },
    include: { semesters: true },
  });

  await prisma.schoolSettings.create({
    data: {
      id: 1,
      nameAr: "مدرسة أكاديميا الخاصة",
      nameFr: "École Academia Privée",
      addressAr: "شارع محمد الخامس، مراكش",
      addressFr: "Avenue Mohammed V, Marrakech",
      phone: "+212 524 00 00 00",
      email: "contact@academia.ma",
      primaryColor: "#1e6f5c",
      secondaryColor: "#c8a35a",
      currentSchoolYearId: year.id,
    },
  });

  // ---------------------------------------------------------------- structure
  console.log("· cycles, levels, streams");
  const primaire = await prisma.cycle.create({
    data: { kind: CycleKind.PRIMAIRE, nameAr: "التعليم الابتدائي", nameFr: "Primaire", order: 1 },
  });
  const college = await prisma.cycle.create({
    data: { kind: CycleKind.COLLEGE, nameAr: "التعليم الإعدادي", nameFr: "Collège", order: 2 },
  });
  const lycee = await prisma.cycle.create({
    data: { kind: CycleKind.LYCEE, nameAr: "التعليم الثانوي التأهيلي", nameFr: "Lycée", order: 3 },
  });

  const levelData = [
    ...[1, 2, 3, 4, 5, 6].map((i) => ({
      cycleId: primaire.id, code: `${i}AP`,
      nameAr: `المستوى ${i} ابتدائي`, nameFr: `${i}ère année primaire`.replace("1ère", "1ère"), order: i,
    })),
    ...[1, 2, 3].map((i) => ({
      cycleId: college.id, code: `${i}AC`,
      nameAr: `${i} إعدادي`, nameFr: `${i}ère année collège`, order: 10 + i,
    })),
    { cycleId: lycee.id, code: "TC", nameAr: "الجذع المشترك", nameFr: "Tronc Commun", order: 21 },
    { cycleId: lycee.id, code: "1BAC", nameAr: "الأولى باكالوريا", nameFr: "1ère Bac", order: 22 },
    { cycleId: lycee.id, code: "2BAC", nameAr: "الثانية باكالوريا", nameFr: "2ème Bac", order: 23 },
  ];
  await prisma.level.createMany({ data: levelData });
  const levels = await prisma.level.findMany();
  const byCode = (c: string) => levels.find((l) => l.code === c)!;

  const streamDefs = [
    { code: "SM", nameAr: "علوم رياضية", nameFr: "Sciences Mathématiques" },
    { code: "PC", nameAr: "علوم فيزيائية", nameFr: "Sciences Physiques" },
    { code: "SVT", nameAr: "علوم الحياة والأرض", nameFr: "Sciences de la Vie et de la Terre" },
    { code: "LETTRES", nameAr: "آداب وعلوم إنسانية", nameFr: "Lettres et Sciences Humaines" },
    { code: "ECO", nameAr: "علوم اقتصادية", nameFr: "Sciences Économiques" },
  ];
  for (const lvl of ["1BAC", "2BAC"]) {
    await prisma.stream.createMany({
      data: streamDefs.map((s) => ({ ...s, levelId: byCode(lvl).id })),
    });
  }
  const streams = await prisma.stream.findMany();
  const stream = (levelCode: string, code: string) =>
    streams.find((s) => s.levelId === byCode(levelCode).id && s.code === code)!;

  // ---------------------------------------------------------------- subjects
  console.log("· subjects + coefficients");
  const subjectDefs = [
    { code: "ARA", nameAr: "اللغة العربية", nameFr: "Langue Arabe" },
    { code: "FRA", nameAr: "اللغة الفرنسية", nameFr: "Langue Française" },
    { code: "ANG", nameAr: "اللغة الإنجليزية", nameFr: "Langue Anglaise" },
    { code: "MATH", nameAr: "الرياضيات", nameFr: "Mathématiques" },
    { code: "PC", nameAr: "الفيزياء والكيمياء", nameFr: "Physique-Chimie" },
    { code: "SVT", nameAr: "علوم الحياة والأرض", nameFr: "Sciences de la Vie et de la Terre" },
    { code: "HG", nameAr: "الاجتماعيات", nameFr: "Histoire-Géographie" },
    { code: "EI", nameAr: "التربية الإسلامية", nameFr: "Éducation Islamique" },
    { code: "PHILO", nameAr: "الفلسفة", nameFr: "Philosophie" },
    { code: "EPS", nameAr: "التربية البدنية", nameFr: "Éducation Physique et Sportive" },
    { code: "INFO", nameAr: "المعلوميات", nameFr: "Informatique" },
    { code: "AS", nameAr: "النشاط العلمي", nameFr: "Activité Scientifique" },
  ];
  await prisma.subject.createMany({ data: subjectDefs });
  const subjects = await prisma.subject.findMany();
  const subj = (code: string) => subjects.find((s) => s.code === code)!;

  // 2BAC PC coefficients (real Moroccan weighting)
  const coef2BacPC: Array<[string, number]> = [
    ["MATH", 7], ["PC", 7], ["SVT", 5], ["ANG", 2],
    ["PHILO", 2], ["ARA", 2], ["FRA", 4], ["EI", 2], ["EPS", 2],
  ];
  await prisma.levelSubject.createMany({
    data: coef2BacPC.map(([code, coefficient]) => ({
      levelId: byCode("2BAC").id,
      streamId: stream("2BAC", "PC").id,
      subjectId: subj(code).id,
      coefficient,
    })),
  });

  // 2BAC SM
  const coef2BacSM: Array<[string, number]> = [
    ["MATH", 9], ["PC", 7], ["SVT", 3], ["ANG", 2],
    ["PHILO", 2], ["ARA", 2], ["FRA", 4], ["EI", 2], ["EPS", 2],
  ];
  await prisma.levelSubject.createMany({
    data: coef2BacSM.map(([code, coefficient]) => ({
      levelId: byCode("2BAC").id,
      streamId: stream("2BAC", "SM").id,
      subjectId: subj(code).id,
      coefficient,
    })),
  });

  // Collège 3AC (no stream)
  const coef3AC: Array<[string, number]> = [
    ["ARA", 4], ["FRA", 4], ["ANG", 2], ["MATH", 4],
    ["PC", 2], ["SVT", 2], ["HG", 2], ["EI", 2], ["EPS", 1], ["INFO", 1],
  ];
  await prisma.levelSubject.createMany({
    data: coef3AC.map(([code, coefficient]) => ({
      levelId: byCode("3AC").id,
      streamId: null,
      subjectId: subj(code).id,
      coefficient,
    })),
  });

  // Primaire 6AP
  const coef6AP: Array<[string, number]> = [
    ["ARA", 4], ["FRA", 3], ["MATH", 4], ["AS", 2], ["EI", 2], ["EPS", 1],
  ];
  await prisma.levelSubject.createMany({
    data: coef6AP.map(([code, coefficient]) => ({
      levelId: byCode("6AP").id,
      streamId: null,
      subjectId: subj(code).id,
      coefficient,
    })),
  });

  // ---------------------------------------------------------------- rooms & classes
  console.log("· rooms + classes");
  await prisma.room.createMany({
    data: [
      { name: "Salle 1", capacity: 36, building: "A" },
      { name: "Salle 2", capacity: 36, building: "A" },
      { name: "Salle 3", capacity: 30, building: "B" },
      { name: "Labo PC", capacity: 24, building: "B" },
      { name: "Salle Info", capacity: 24, building: "B" },
      { name: "Terrain", capacity: 60, building: "—" },
    ],
  });

  const class2BacPC = await prisma.class.create({
    data: {
      name: "2Bac PC - A", levelId: byCode("2BAC").id,
      streamId: stream("2BAC", "PC").id, schoolYearId: year.id, capacity: 34,
    },
  });
  const class3AC = await prisma.class.create({
    data: { name: "3AC - B", levelId: byCode("3AC").id, schoolYearId: year.id, capacity: 36 },
  });
  const class6AP = await prisma.class.create({
    data: { name: "6AP - A", levelId: byCode("6AP").id, schoolYearId: year.id, capacity: 30 },
  });

  // ---------------------------------------------------------------- staff
  console.log("· staff (director, surveillant, teachers)");
  await prisma.user.create({
    data: {
      email: "directeur@academia.ma", passwordHash, role: Role.DIRECTOR, locale: "fr",
      firstNameAr: "عبد الرحيم", lastNameAr: "بنجلون",
      firstNameFr: "Abderrahim", lastNameFr: "Benjelloun",
      phone: "+212 661 00 00 01",
    },
  });
  await prisma.user.create({
    data: {
      email: "surveillant@academia.ma", passwordHash, role: Role.SURVEILLANT, locale: "fr",
      firstNameAr: "خالد", lastNameAr: "الطاهري",
      firstNameFr: "Khalid", lastNameFr: "Tahiri",
      phone: "+212 661 00 00 02",
    },
  });

  const teacherDefs = [
    { email: "prof.maths@academia.ma", ar: ["سعيد", "العلوي"], fr: ["Said", "Alaoui"], subjects: ["MATH"], specialty: "Mathématiques" },
    { email: "prof.pc@academia.ma", ar: ["نادية", "الفاسي"], fr: ["Nadia", "Fassi"], subjects: ["PC"], specialty: "Physique-Chimie" },
    { email: "prof.arabe@academia.ma", ar: ["مصطفى", "الإدريسي"], fr: ["Mustapha", "Idrissi"], subjects: ["ARA", "EI"], specialty: "Langue Arabe" },
    { email: "prof.francais@academia.ma", ar: ["ليلى", "برادة"], fr: ["Leila", "Berrada"], subjects: ["FRA"], specialty: "Langue Française" },
    { email: "prof.svt@academia.ma", ar: ["يونس", "الحسني"], fr: ["Younes", "Hassani"], subjects: ["SVT"], specialty: "SVT" },
  ];

  const teacherProfiles: Record<string, string> = {};
  for (const [i, t] of teacherDefs.entries()) {
    const user = await prisma.user.create({
      data: {
        email: t.email, passwordHash, role: Role.TEACHER, locale: "fr",
        firstNameAr: t.ar[0], lastNameAr: t.ar[1],
        firstNameFr: t.fr[0], lastNameFr: t.fr[1],
        phone: `+212 661 00 01 ${String(10 + i).padStart(2, "0")}`,
        teacherProfile: {
          create: {
            employeeNo: `ENS-${String(100 + i)}`,
            hiredAt: new Date("2021-09-01"),
            specialty: t.specialty,
            subjects: { create: t.subjects.map((c) => ({ subjectId: subj(c).id })) },
          },
        },
      },
      include: { teacherProfile: true },
    });
    teacherProfiles[t.subjects[0]] = user.teacherProfile!.id;
  }

  // main teacher (professeur principal) of 2Bac PC
  await prisma.class.update({
    where: { id: class2BacPC.id },
    data: { mainTeacherId: teacherProfiles["MATH"] },
  });

  // teacher ↔ class ↔ subject assignments
  const assignments = [
    { c: class2BacPC.id, s: "MATH", t: teacherProfiles["MATH"] },
    { c: class2BacPC.id, s: "PC", t: teacherProfiles["PC"] },
    { c: class2BacPC.id, s: "SVT", t: teacherProfiles["SVT"] },
    { c: class2BacPC.id, s: "ARA", t: teacherProfiles["ARA"] },
    { c: class2BacPC.id, s: "FRA", t: teacherProfiles["FRA"] },
    { c: class3AC.id, s: "MATH", t: teacherProfiles["MATH"] },
    { c: class3AC.id, s: "ARA", t: teacherProfiles["ARA"] },
    { c: class3AC.id, s: "FRA", t: teacherProfiles["FRA"] },
    { c: class6AP.id, s: "ARA", t: teacherProfiles["ARA"] },
    { c: class6AP.id, s: "FRA", t: teacherProfiles["FRA"] },
  ];
  await prisma.teacherAssignment.createMany({
    data: assignments.map((a) => ({
      teacherId: a.t, classId: a.c, subjectId: subj(a.s).id, schoolYearId: year.id,
    })),
  });

  // ---------------------------------------------------------------- timetable sample (2Bac PC)
  console.log("· sample timetable for 2Bac PC");
  const rooms = await prisma.room.findMany();
  const room = (n: string) => rooms.find((r) => r.name === n)!;
  const slots = [
    { day: Weekday.MONDAY, start: 8 * 60, end: 10 * 60, s: "MATH", r: "Salle 1" },
    { day: Weekday.MONDAY, start: 10 * 60 + 15, end: 12 * 60 + 15, s: "PC", r: "Labo PC" },
    { day: Weekday.TUESDAY, start: 8 * 60, end: 10 * 60, s: "SVT", r: "Salle 2" },
    { day: Weekday.TUESDAY, start: 14 * 60, end: 16 * 60, s: "FRA", r: "Salle 1" },
    { day: Weekday.WEDNESDAY, start: 8 * 60, end: 10 * 60, s: "MATH", r: "Salle 1" },
    { day: Weekday.THURSDAY, start: 10 * 60 + 15, end: 12 * 60 + 15, s: "ARA", r: "Salle 3" },
    { day: Weekday.FRIDAY, start: 8 * 60, end: 10 * 60, s: "PC", r: "Labo PC" },
  ];
  await prisma.timetableSlot.createMany({
    data: slots.map((sl) => ({
      schoolYearId: year.id, classId: class2BacPC.id, subjectId: subj(sl.s).id,
      teacherId: teacherProfiles[sl.s], roomId: room(sl.r).id,
      weekday: sl.day, startMin: sl.start, endMin: sl.end,
    })),
  });
  // Ramadan variant: shortened, morning-only
  await prisma.timetableSlot.createMany({
    data: slots.slice(0, 5).map((sl, i) => ({
      schoolYearId: year.id, classId: class2BacPC.id, subjectId: subj(sl.s).id,
      teacherId: teacherProfiles[sl.s], roomId: room(sl.r).id,
      weekday: sl.day, startMin: 9 * 60 + i * 0, endMin: 10 * 60 + 30,
      variant: "RAMADAN" as const,
    })),
  });

  // ---------------------------------------------------------------- students & parents
  console.log("· students, guardians, parent accounts");
  const classesForStudents = [
    { klass: class2BacPC, count: 12, birthYear: 2008 },
    { klass: class3AC, count: 8, birthYear: 2011 },
    { klass: class6AP, count: 6, birthYear: 2014 },
  ];

  let n = 0;
  for (const group of classesForStudents) {
    for (let i = 0; i < group.count; i++) {
      const isMale = n % 2 === 0;
      const [firstAr, firstFr] = isMale
        ? MALE_NAMES[n % MALE_NAMES.length]
        : FEMALE_NAMES[n % FEMALE_NAMES.length];
      const [lastAr, lastFr] = FAMILY_NAMES[n % FAMILY_NAMES.length];

      const student = await prisma.user.create({
        data: {
          email: `eleve${n + 1}@academia.ma`, passwordHash, role: Role.STUDENT, locale: "ar",
          firstNameAr: firstAr, lastNameAr: lastAr,
          firstNameFr: firstFr, lastNameFr: lastFr,
          studentProfile: {
            create: {
              codeMassar: codeMassar(n + 1),
              birthDate: new Date(`${group.birthYear}-0${(n % 9) + 1}-1${n % 9}`),
              birthPlaceAr: "مراكش", birthPlaceFr: "Marrakech",
              gender: isMale ? "M" : "F",
              enrollments: { create: { classId: group.klass.id } },
            },
          },
        },
        include: { studentProfile: true },
      });

      // one parent account per 2 students -> a parent with several children
      const shareParent = n % 2 === 1;
      if (!shareParent) {
        const parentUser = await prisma.user.create({
          data: {
            email: `parent${Math.floor(n / 2) + 1}@academia.ma`, passwordHash,
            role: Role.PARENT, locale: "fr",
            firstNameAr: MALE_NAMES[(n + 3) % MALE_NAMES.length][0], lastNameAr: lastAr,
            firstNameFr: MALE_NAMES[(n + 3) % MALE_NAMES.length][1], lastNameFr: lastFr,
            phone: `+212 662 00 ${String(n).padStart(2, "0")} 00`,
            guardian: {
              create: {
                firstNameAr: MALE_NAMES[(n + 3) % MALE_NAMES.length][0], lastNameAr: lastAr,
                firstNameFr: MALE_NAMES[(n + 3) % MALE_NAMES.length][1], lastNameFr: lastFr,
                phone: `+212 662 00 ${String(n).padStart(2, "0")} 00`,
                email: `parent${Math.floor(n / 2) + 1}@academia.ma`,
                professionAr: "أستاذ", professionFr: "Enseignant",
                addressAr: "حي المسيرة، مراكش", addressFr: "Quartier Massira, Marrakech",
              },
            },
          },
          include: { guardian: true },
        });
        await prisma.studentGuardian.create({
          data: {
            studentId: student.studentProfile!.id,
            guardianId: parentUser.guardian!.id,
            relation: GuardianRelation.FATHER,
            isPrimary: true,
          },
        });
      } else {
        // attach to the previous parent -> sibling
        const lastGuardian = await prisma.guardian.findFirst({ orderBy: { id: "desc" } });
        if (lastGuardian) {
          await prisma.studentGuardian.create({
            data: {
              studentId: student.studentProfile!.id,
              guardianId: lastGuardian.id,
              relation: GuardianRelation.FATHER,
              isPrimary: true,
            },
          });
        }
      }
      n++;
    }
  }

  const counts = {
    users: await prisma.user.count(),
    students: await prisma.studentProfile.count(),
    guardians: await prisma.guardian.count(),
    classes: await prisma.class.count(),
    subjects: await prisma.subject.count(),
    coefficients: await prisma.levelSubject.count(),
    slots: await prisma.timetableSlot.count(),
  };
  console.log("\n✔ seed complete", counts);
  console.log(`\n  demo password for every account: ${DEMO_PASSWORD}`);
  console.log("  directeur@academia.ma · surveillant@academia.ma · prof.maths@academia.ma");
  console.log("  eleve1@academia.ma · parent1@academia.ma\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
