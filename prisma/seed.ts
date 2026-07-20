import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  AnnouncementAudience,
  CycleKind,
  GuardianRelation,
  InstallmentStatus,
  JustificationStatus,
  NotificationChannel,
  NotificationStatus,
  PaymentMethod,
  Role,
  Sanction,
  ThreadKind,
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

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
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
      "AuditLog","LessonProgress","LessonAttachment","Lesson","Unit","Attachment","StoredFile","Receipt","PaymentAllocation","Payment",
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
      nameAr: "مدرسة بلانيت مونتيسوري الدولية",
      nameFr: "Planète Montessori International School",
      addressAr: "تجزئة أمين رقم 8، تاركة، مراكش",
      addressFr: "Lotissement Amine, n°8, Targa, Marrakech",
      phone: "+212 6 62 63 24 03",
      email: "planetemontessori@gmail.com",
      logoPath: "/planete-montessori-private-school-marrakech-Frame-11.png",
      primaryColor: "#133562",
      secondaryColor: "#ef5b4e",
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
      email: "directeur@planetemontessori.demo", passwordHash, role: Role.DIRECTOR, locale: "fr",
      firstNameAr: "عبد الرحيم", lastNameAr: "بنجلون",
      firstNameFr: "Abderrahim", lastNameFr: "Benjelloun",
      phone: "+212 661 00 00 01",
    },
  });
  await prisma.user.create({
    data: {
      email: "surveillant@planetemontessori.demo", passwordHash, role: Role.SURVEILLANT, locale: "fr",
      firstNameAr: "خالد", lastNameAr: "الطاهري",
      firstNameFr: "Khalid", lastNameFr: "Tahiri",
      phone: "+212 661 00 00 02",
    },
  });

  const teacherDefs = [
    { email: "prof.maths@planetemontessori.demo", ar: ["سعيد", "العلوي"], fr: ["Said", "Alaoui"], subjects: ["MATH"], specialty: "Mathématiques" },
    { email: "prof.pc@planetemontessori.demo", ar: ["نادية", "الفاسي"], fr: ["Nadia", "Fassi"], subjects: ["PC"], specialty: "Physique-Chimie" },
    { email: "prof.arabe@planetemontessori.demo", ar: ["مصطفى", "الإدريسي"], fr: ["Mustapha", "Idrissi"], subjects: ["ARA", "EI"], specialty: "Langue Arabe" },
    { email: "prof.francais@planetemontessori.demo", ar: ["ليلى", "برادة"], fr: ["Leila", "Berrada"], subjects: ["FRA"], specialty: "Langue Française" },
    { email: "prof.svt@planetemontessori.demo", ar: ["يونس", "الحسني"], fr: ["Younes", "Hassani"], subjects: ["SVT"], specialty: "SVT" },
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
          email: `eleve${n + 1}@planetemontessori.demo`, passwordHash, role: Role.STUDENT, locale: "ar",
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
            email: `parent${Math.floor(n / 2) + 1}@planetemontessori.demo`, passwordHash,
            role: Role.PARENT, locale: "fr",
            firstNameAr: MALE_NAMES[(n + 3) % MALE_NAMES.length][0], lastNameAr: lastAr,
            firstNameFr: MALE_NAMES[(n + 3) % MALE_NAMES.length][1], lastNameFr: lastFr,
            phone: `+212 662 00 ${String(n).padStart(2, "0")} 00`,
            guardian: {
              create: {
                firstNameAr: MALE_NAMES[(n + 3) % MALE_NAMES.length][0], lastNameAr: lastAr,
                firstNameFr: MALE_NAMES[(n + 3) % MALE_NAMES.length][1], lastNameFr: lastFr,
                phone: `+212 662 00 ${String(n).padStart(2, "0")} 00`,
                email: `parent${Math.floor(n / 2) + 1}@planetemontessori.demo`,
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

  // ---------------------------------------------------------------- demo operations
  // The structure above is enough to log in. The records below make every
  // workspace useful on first launch: grades, attendance, pedagogy, finance,
  // communication, notifications, and audit history all have real relationships.
  console.log("· demo grades, attendance, pedagogy, finance and communication");

  const director = await prisma.user.findUniqueOrThrow({
    where: { email: "directeur@planetemontessori.demo" },
  });
  const surveillant = await prisma.user.findUniqueOrThrow({
    where: { email: "surveillant@planetemontessori.demo" },
  });
  const demoTeachers = await prisma.teacherProfile.findMany({
    include: { user: true },
  });
  const demoStudents = await prisma.studentProfile.findMany({
    include: { user: true, enrollments: true, guardians: { include: { guardian: { include: { user: true } } } } },
    orderBy: { codeMassar: "asc" },
  });
  const studentsIn = (classId: string) => demoStudents.filter((s) =>
    s.enrollments.some((e) => e.classId === classId && e.isActive),
  );
  const teacherFor = (subjectCode: string) => teacherProfiles[subjectCode] ?? teacherProfiles.MATH;
  const teacherUserFor = (subjectCode: string) =>
    demoTeachers.find((t) => t.id === teacherFor(subjectCode))!.user;
  const parentUsers = demoStudents
    .flatMap((s) => s.guardians.map((g) => g.guardian.user).filter((u): u is NonNullable<typeof u> => Boolean(u)))
    .filter((u, i, all) => all.findIndex((x) => x.id === u.id) === i);

  // Gradebook: two semesters, several assessment types, blank and graded cells.
  const gradeSubjects: Array<[string, number]> = [
    ["MATH", 7], ["PC", 7], ["SVT", 5], ["FRA", 4], ["ARA", 2],
  ];
  const classGradeConfigs = [
    { klass: class2BacPC, subjects: gradeSubjects },
    { klass: class3AC, subjects: [["MATH", 4], ["FRA", 4], ["ARA", 4]] as Array<[string, number]> },
  ];
  for (const config of classGradeConfigs) {
    const roster = studentsIn(config.klass.id);
    for (const [subjectCode] of config.subjects) {
      for (const semester of year.semesters) {
        for (const [kind, index] of [["CONTROLE", 1], ["CONTROLE", 2], ["ACTIVITE", 1]] as const) {
          const item = await prisma.gradeItem.create({
            data: {
              classId: config.klass.id,
              subjectId: subj(subjectCode).id,
              semesterId: semester.id,
              kind,
              index,
              label: kind === "ACTIVITE" ? "Travail continu" : `Contrôle ${index}`,
              maxScore: 20,
              weight: kind === "ACTIVITE" ? 1 : 2,
              createdById: teacherFor(subjectCode),
            },
          });
          await prisma.grade.createMany({
            data: roster.map((student, studentIndex) => ({
              gradeItemId: item.id,
              studentId: student.id,
              score: studentIndex % 11 === 0 && kind === "ACTIVITE"
                ? null
                : Math.min(20, 11 + ((studentIndex * 3 + index * 2 + semester.index) % 9)),
              enteredById: teacherUserFor(subjectCode).id,
            })),
          });
        }
      }
    }
  }

  const semester1 = year.semesters.find((s) => s.index === 1)!;
  await prisma.semester.update({
    where: { id: semester1.id },
    data: { gradesPublishedAt: day("2026-01-20") },
  });
  const appreciations = [
    ["Très bon trimestre, participation régulière et travail précis.", "Excellent engagement et bonne maîtrise des notions."],
    ["Des progrès visibles. Continue à revoir les méthodes.", "مجهود واضح وتقدم مستمر، واصل المراجعة."],
  ];
  for (const [i, student] of demoStudents.slice(0, 8).entries()) {
    await prisma.subjectAppreciation.create({
      data: {
        studentId: student.id,
        subjectId: subj(i % 2 === 0 ? "MATH" : "PC").id,
        classId: class2BacPC.id,
        semesterId: semester1.id,
        teacherId: teacherFor(i % 2 === 0 ? "MATH" : "PC"),
        text: appreciations[i % appreciations.length][0],
      },
    });
  }

  // Attendance: recent sessions with a mixture of absences, lates, and excused records.
  const normalSlots = await prisma.timetableSlot.findMany({
    where: { classId: class2BacPC.id, variant: "NORMAL" },
    orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
  });
  const attendanceSlots = normalSlots.filter((slot, index, all) =>
    all.findIndex((candidate) => candidate.startMin === slot.startMin) === index,
  ).slice(0, 3);
  const attendanceDates = ["2026-01-12", "2026-01-13", "2026-01-15", "2026-01-16"];
  const attendanceSessions: { id: string; studentIds: string[] }[] = [];
  for (const [dateIndex, iso] of attendanceDates.entries()) {
    for (const slot of attendanceSlots) {
      const session = await prisma.session.create({
        data: {
          slotId: slot.id,
          classId: slot.classId,
          subjectId: slot.subjectId,
          teacherId: slot.teacherId,
          roomId: slot.roomId,
          date: day(iso),
          startMin: slot.startMin,
          endMin: slot.endMin,
        },
      });
      const roster = studentsIn(class2BacPC.id);
      await prisma.attendanceRecord.createMany({
        data: roster.map((student, studentIndex) => ({
          sessionId: session.id,
          studentId: student.id,
          status: studentIndex === dateIndex % roster.length
            ? "ABSENT" as const
            : studentIndex === (dateIndex + 2) % roster.length
              ? "LATE" as const
              : "PRESENT" as const,
          lateMinutes: studentIndex === (dateIndex + 2) % roster.length ? 8 + dateIndex : null,
          markedById: surveillant.id,
          comment: studentIndex === (dateIndex + 2) % roster.length ? "Arrivée après la sonnerie" : null,
        })),
      });
      attendanceSessions.push({ id: session.id, studentIds: roster.map((s) => s.id) });
    }
  }
  await prisma.absenceJustification.create({
    data: {
      studentId: demoStudents[0].id,
      reason: "Certificat médical transmis par la famille.",
      fromDate: day("2026-01-15"),
      toDate: day("2026-01-15"),
      status: JustificationStatus.PENDING,
    },
  });
  const approvedJustification = await prisma.absenceJustification.create({
    data: {
      studentId: demoStudents[2].id,
      reason: "Déplacement familial exceptionnel.",
      fromDate: day("2026-01-12"),
      toDate: day("2026-01-12"),
      status: JustificationStatus.APPROVED,
      reviewedById: surveillant.id,
      reviewedAt: day("2026-01-13"),
      reviewNote: "Justificatif accepté par la vie scolaire.",
    },
  });
  await prisma.attendanceRecord.updateMany({
    where: {
      studentId: approvedJustification.studentId,
      status: "ABSENT",
      session: { date: { gte: approvedJustification.fromDate, lte: approvedJustification.toDate } },
    },
    data: { isExcused: true, justificationId: approvedJustification.id },
  });
  await prisma.disciplineIncident.createMany({
    data: [
      {
        studentId: demoStudents[4].id,
        classId: class2BacPC.id,
        type: "TARDINESS",
        description: "Retards répétés observés cette semaine.",
        sanction: Sanction.AVERTISSEMENT,
        occurredAt: day("2026-01-14"),
        reportedById: surveillant.id,
      },
      {
        studentId: demoStudents[7].id,
        classId: class3AC.id,
        type: "BEHAVIOUR",
        description: "Incident traité lors d'un échange avec la famille.",
        sanction: Sanction.NONE,
        occurredAt: day("2026-01-10"),
        reportedById: surveillant.id,
      },
    ],
  });

  // Cahier de textes and homework: published, upcoming, submitted, and reviewed.
  const homeworkSeeds = [
    { subject: "MATH", title: "Fonctions dérivées", instructions: "Exercices 12 à 18 du polycopié.", due: "2026-01-22" },
    { subject: "PC", title: "Compte rendu de TP", instructions: "Rédiger le compte rendu du TP sur les transformations chimiques.", due: "2026-01-28" },
    { subject: "MATH", title: "Révisions bac blanc", instructions: "Préparer les exercices de synthèse pour la séance prochaine.", due: "2026-02-05" },
  ];
  for (const [index, h] of homeworkSeeds.entries()) {
    const teacherId = teacherFor(h.subject);
    const homework = await prisma.homework.create({
      data: {
        classId: class2BacPC.id,
        subjectId: subj(h.subject).id,
        teacherId,
        title: h.title,
        instructions: h.instructions,
        assignedAt: day(`2026-01-${String(10 + index).padStart(2, "0")}`),
        dueAt: new Date(`${h.due}T23:59:59.000Z`),
        isPublished: index !== 2,
      },
    });
    if (index < 2) {
      const submitters = studentsIn(class2BacPC.id).slice(0, index === 0 ? 5 : 3);
      await prisma.homeworkSubmission.createMany({
        data: submitters.map((student, studentIndex) => ({
          homeworkId: homework.id,
          studentId: student.id,
          submittedAt: day(`2026-01-${String(16 + studentIndex).padStart(2, "0")}`),
          isLate: studentIndex === 3,
          studentNote: studentIndex === 1 ? "J'ai ajouté les étapes du calcul." : null,
          grade: index === 0 && studentIndex < 3 ? 13 + studentIndex : null,
          teacherComment: index === 0 && studentIndex < 3 ? "Méthode claire, attention à la rédaction." : null,
          reviewedAt: index === 0 && studentIndex < 3 ? day("2026-01-20") : null,
        })),
      });
    }
  }
  for (const [index, session] of attendanceSessions.slice(0, 4).entries()) {
    await prisma.cahierEntry.create({
      data: {
        sessionId: session.id,
        classId: class2BacPC.id,
        subjectId: subj(index % 2 === 0 ? "MATH" : "PC").id,
        teacherId: teacherFor(index % 2 === 0 ? "MATH" : "PC"),
        date: day(attendanceDates[index]),
        title: index % 2 === 0 ? "Dérivation et variations" : "Réactions acido-basiques",
        description: index % 2 === 0 ? "Cours, exemples guidés et exercices d'application." : "Expérience en laboratoire et conclusion collective.",
      },
    });
  }

  // Fees: yearly charges, monthly tuition, partial payments, and overdue balances.
  const feeItems = await Promise.all([
    prisma.feeItem.create({ data: { schoolYearId: year.id, levelId: null, kind: "INSCRIPTION", nameAr: "واجب التسجيل", nameFr: "Frais d'inscription", amount: 1200, isMonthly: false } }),
    prisma.feeItem.create({ data: { schoolYearId: year.id, levelId: null, kind: "TUITION", nameAr: "واجبات التمدرس", nameFr: "Scolarité", amount: 1800, isMonthly: true } }),
    prisma.feeItem.create({ data: { schoolYearId: year.id, levelId: null, kind: "CANTINE", nameAr: "المطعم المدرسي", nameFr: "Cantine", amount: 450, isMonthly: true } }),
    prisma.feeItem.create({ data: { schoolYearId: year.id, levelId: null, kind: "TRANSPORT", nameAr: "النقل المدرسي", nameFr: "Transport scolaire", amount: 600, isMonthly: true } }),
  ]);
  const schedules: { studentId: string; scheduleId: string; installments: { id: string; amount: number }[] }[] = [];
  for (const student of demoStudents) {
    const schedule = await prisma.feeSchedule.create({
      data: {
        studentId: student.id,
        schoolYearId: year.id,
        siblingDiscount: student.guardians.length > 0 && demoStudents.indexOf(student) % 4 === 0 ? 150 : 0,
        customDiscount: demoStudents.indexOf(student) % 7 === 0 ? 100 : 0,
        discountNote: demoStudents.indexOf(student) % 7 === 0 ? "Bourse Planète Montessori" : null,
        installments: {
          create: feeItems.flatMap((item, itemIndex) => item.isMonthly
            ? ["2025-10-05", "2025-11-05", "2025-12-05"].map((date, monthIndex) => ({
                feeItemId: item.id,
                label: `${itemIndex === 1 ? "Octobre" : itemIndex === 2 ? "Novembre" : "Décembre"} ${monthIndex + 1}`,
                dueDate: day(date),
                amount: Number(item.amount) / 3,
                status: InstallmentStatus.PENDING,
              }))
            : [{ feeItemId: item.id, label: "Annuel", dueDate: day("2025-09-15"), amount: Number(item.amount), status: InstallmentStatus.PENDING }]),
        },
      },
      include: { installments: true },
    });
    schedules.push({
      studentId: student.id,
      scheduleId: schedule.id,
      installments: schedule.installments.map((i) => ({ id: i.id, amount: Number(i.amount) })),
    });
  }
  let receiptNumber = 1;
  for (const [studentIndex, schedule] of schedules.slice(0, 10).entries()) {
    const installment = schedule.installments[studentIndex % schedule.installments.length];
    const amount = studentIndex % 3 === 0 ? Number(installment.amount) : Math.min(900, Number(installment.amount));
    const payment = await prisma.payment.create({
      data: {
        feeScheduleId: schedule.scheduleId,
        studentId: schedule.studentId,
        amount,
        method: [PaymentMethod.CASH, PaymentMethod.CHECK, PaymentMethod.TRANSFER][studentIndex % 3],
        paidAt: day(`2026-01-${String(5 + (studentIndex % 10)).padStart(2, "0")}`),
        reference: studentIndex % 3 === 1 ? `CHQ-2026-${String(100 + studentIndex)}` : null,
        note: studentIndex === 0 ? "Règlement du premier trimestre" : null,
        recordedById: director.id,
        allocations: { create: { installmentId: installment.id, amount } },
        receipt: { create: { number: receiptNumber++ } },
      },
    });
    await prisma.installment.update({
      where: { id: installment.id },
      data: { amountPaid: amount, status: amount >= Number(installment.amount) ? InstallmentStatus.PAID : InstallmentStatus.PARTIAL },
    });
    void payment;
  }
  await prisma.installment.updateMany({
    where: { dueDate: { lt: day("2026-01-01") }, amountPaid: 0 },
    data: { status: InstallmentStatus.OVERDUE },
  });

  // E-learning demo content: bilingual units and published lessons for the two demo classes.
  const mathUnit = await prisma.unit.create({
    data: {
      authorId: teacherProfiles.MATH,
      levelId: class2BacPC.levelId,
      streamId: class2BacPC.streamId,
      subjectId: subj("MATH").id,
      titleAr: "الاشتقاق وتغيرات الدوال",
      titleFr: "Dérivation et variations",
      order: 1,
      lessons: {
        create: [
          { order: 1, titleAr: "مفهوم المشتقة", titleFr: "Comprendre la dérivée", contentAr: "المشتقة تصف معدل تغير الدالة عند نقطة. ابدأ بحساب معدل التغير بين نقطتين ثم انتقل إلى النهاية.", contentFr: "La dérivée décrit le taux de variation d'une fonction en un point. Commencez par le taux de variation entre deux points, puis passez à la limite.", isPublished: true, publishedAt: day("2026-01-08") },
          { order: 2, titleAr: "اتجاه التغير", titleFr: "Sens de variation", contentAr: "نستخدم إشارة المشتقة لتحديد فترات التزايد والتناقص، ثم نبني جدول التغيرات.", contentFr: "Le signe de la dérivée permet de déterminer les intervalles de croissance et de décroissance, puis de construire le tableau de variations.", isPublished: true, publishedAt: day("2026-01-10") },
        ],
      },
    },
  });
  const physicsUnit = await prisma.unit.create({
    data: {
      authorId: teacherProfiles.PC,
      levelId: class2BacPC.levelId,
      streamId: class2BacPC.streamId,
      subjectId: subj("PC").id,
      titleAr: "التفاعلات الحمضية القاعدية",
      titleFr: "Réactions acido-basiques",
      order: 1,
      lessons: {
        create: { order: 1, titleAr: "مفهوم الحمض والقاعدة", titleFr: "Acides et bases", contentAr: "الحمض يمنح بروتوناً والقاعدة تستقبل بروتوناً. نحدد الزوجين المترافقين في كل تفاعل.", contentFr: "Un acide cède un proton et une base capte un proton. Identifiez les couples conjugués dans chaque réaction.", isPublished: true, publishedAt: day("2026-01-09") },
      },
    },
  });
  // A collège unit: no stream (3AC has none), so it is level-wide. Also carries
  // a draft, which must stay invisible to students until it is published.
  const collegeUnit = await prisma.unit.create({
    data: {
      authorId: teacherProfiles.MATH,
      levelId: class3AC.levelId,
      streamId: class3AC.streamId,
      subjectId: subj("MATH").id,
      titleAr: "الأعداد الجذرية",
      titleFr: "Les nombres rationnels",
      order: 1,
      lessons: {
        create: [
          { order: 1, titleAr: "جمع الأعداد الجذرية", titleFr: "Additionner des rationnels", contentAr: "لجمع عددين جذريين نوحد المقامات ثم نجمع البسطين.", contentFr: "Pour additionner deux rationnels, on réduit au même dénominateur puis on additionne les numérateurs.", isPublished: true, publishedAt: day("2026-01-12") },
          { order: 2, titleAr: "ضرب الأعداد الجذرية", titleFr: "Multiplier des rationnels", contentAr: "نضرب البسط في البسط والمقام في المقام ثم نبسط.", contentFr: "On multiplie les numérateurs entre eux et les dénominateurs entre eux, puis on simplifie.", isPublished: false },
        ],
      },
    },
  });

  void mathUnit;
  void physicsUnit;
  void collegeUnit;

  // Announcements, parent/teacher conversations, notifications, and audit trail.
  const announcements = await prisma.announcement.createMany({
    data: [
      { authorId: director.id, titleAr: "اجتماع أولياء الأمور", titleFr: "Réunion de parents", bodyAr: "يسر إدارة بلانيت مونتيسوري دعوتكم إلى لقاء أولياء الأمور يوم السبت.", bodyFr: "La direction de Planète Montessori vous invite à la réunion de parents samedi matin.", audience: AnnouncementAudience.PARENTS, isPublished: true, publishAt: day("2026-01-08") },
      { authorId: director.id, titleAr: "توقيت رمضان", titleFr: "Horaires de Ramadan", bodyAr: "سيبدأ العمل بتوقيت رمضان يوم 17 فبراير.", bodyFr: "Les horaires de Ramadan entreront en vigueur le 17 février.", audience: AnnouncementAudience.WHOLE_SCHOOL, isPublished: true, publishAt: day("2026-01-18") },
      { authorId: surveillant.id, titleAr: "تذكير بالانضباط", titleFr: "Rappel de vie scolaire", bodyAr: "يرجى احترام أوقات الدخول والخروج.", bodyFr: "Merci de respecter les horaires d'entrée et de sortie.", audience: AnnouncementAudience.CLASS, classId: class2BacPC.id, isPublished: true, publishAt: day("2026-01-14") },
      { authorId: director.id, titleAr: "برنامج المجلس", titleFr: "Ordre du jour du conseil", bodyAr: "الاجتماع مخصص لتتبع نتائج الدورة الأولى.", bodyFr: "Le conseil de classe portera sur le bilan du premier semestre.", audience: AnnouncementAudience.TEACHERS, isPublished: false, publishAt: day("2026-01-19") },
    ],
  });
  void announcements;
  const firstParent = parentUsers[0];
  const firstTeacher = teacherUserFor("MATH");
  if (firstParent) {
    const thread = await prisma.messageThread.create({
      data: {
        kind: ThreadKind.PARENT_TEACHER,
        subject: "Suivi des progrès en mathématiques",
        classId: class2BacPC.id,
        participants: { create: [{ userId: firstParent.id }, { userId: firstTeacher.id }] },
        messages: {
          create: [
            { senderId: firstParent.id, body: "Bonjour, pourriez-vous me dire comment Ahmed peut progresser en mathématiques ?", createdAt: day("2026-01-15") },
            { senderId: firstTeacher.id, body: "Bonjour, ses efforts sont réguliers. Je recommande de reprendre les exercices 12 à 18.", createdAt: day("2026-01-16") },
          ],
        },
      },
    });
    await prisma.threadParticipant.update({ where: { threadId_userId: { threadId: thread.id, userId: firstTeacher.id } }, data: { lastReadAt: day("2026-01-16") } });
  }
  await prisma.notification.createMany({
    data: [
      ...parentUsers.slice(0, 8).map((user) => ({ userId: user.id, type: "ABSENCE_ALERT", titleAr: "تنبيه غياب", titleFr: "Alerte d'absence", bodyAr: "تم تسجيل غياب جديد يخص ابنكم.", bodyFr: "Une nouvelle absence concerne votre enfant.", link: "/parent/attendance", channel: NotificationChannel.IN_APP, status: NotificationStatus.SENT, sentAt: day("2026-01-16"), readAt: null })),
      { userId: director.id, type: "PAYMENT_DUE", titleAr: "أداءات مستحقة", titleFr: "Paiements à suivre", bodyAr: "توجد أرصدة مدرسية تحتاج إلى متابعة.", bodyFr: "Des soldes de scolarité nécessitent un suivi.", link: "/director/fees", channel: NotificationChannel.IN_APP, status: NotificationStatus.PENDING },
      { userId: firstTeacher.id, type: "HOMEWORK_SUBMISSION", titleAr: "تسليم واجب", titleFr: "Devoir rendu", bodyAr: "قام تلميذ بتسليم واجب.", bodyFr: "Un élève a rendu un devoir.", link: "/teacher/homework", channel: NotificationChannel.IN_APP, status: NotificationStatus.PENDING },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { actorId: director.id, action: "SCHOOL_SETTINGS_UPDATE", entity: "SchoolSettings", entityId: "1", after: { primaryColor: "#133562", secondaryColor: "#ef5b4e" }, createdAt: day("2026-01-05") },
      { actorId: director.id, action: "SCHEDULE_GENERATE_CLASS", entity: "Class", entityId: class2BacPC.id, after: { created: demoStudents.length }, createdAt: day("2026-01-06") },
      { actorId: surveillant.id, action: "ATTENDANCE_MARK", entity: "Session", entityId: attendanceSessions[0]?.id, after: { marked: studentsIn(class2BacPC.id).length }, createdAt: day("2026-01-12") },
      { actorId: firstTeacher.id, action: "GRADE_ENTER", entity: "GradeItem", after: { count: studentsIn(class2BacPC.id).length }, createdAt: day("2026-01-18") },
    ],
  });

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
  console.log("  directeur@planetemontessori.demo · surveillant@planetemontessori.demo · prof.maths@planetemontessori.demo");
  console.log("  eleve1@planetemontessori.demo · parent1@planetemontessori.demo\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
