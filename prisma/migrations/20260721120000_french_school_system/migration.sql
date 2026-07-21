-- Moroccan school system -> French school system.
--
-- Structure, not data: the levels themselves (1AP..6AP / 1AC..3AC / TC / BAC ->
-- CP..CM2 / 6e..3e / 2nde / 1re / Tle) do not map one-to-one — Moroccan
-- primaire runs six years to the French five, college three to the French four
-- — so there is no honest UPDATE that converts one into the other. The seed
-- rewrites that content; this migration only reshapes the tables under it.
--
-- What changes:
--   * CycleKind.PRIMAIRE -> ELEMENTAIRE (existing rows are mapped, not cast)
--   * Stream -> Speciality, and it moves off Class onto the student. Since the
--     2019 reform a class is no longer "1re S": students pick three specialites
--     in Premiere and keep two in Terminale, so two classmates in one room have
--     different subject lists. StudentSpeciality carries that choice per year.
--   * Semester.index now runs 1..3 (trimestres) — no DDL, the column already
--     allowed it; the constraint was only ever in the seed and the labels.
--   * The Ramadan timetable variant and its activation window are removed.

-- AlterEnum
BEGIN;
CREATE TYPE "CycleKind_new" AS ENUM ('ELEMENTAIRE', 'COLLEGE', 'LYCEE');
ALTER TABLE "Cycle" ALTER COLUMN "kind" TYPE "CycleKind_new" USING (
  CASE "kind"::text WHEN 'PRIMAIRE' THEN 'ELEMENTAIRE' ELSE "kind"::text END::"CycleKind_new"
);
ALTER TYPE "CycleKind" RENAME TO "CycleKind_old";
ALTER TYPE "CycleKind_new" RENAME TO "CycleKind";
DROP TYPE "public"."CycleKind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_streamId_fkey";

-- DropForeignKey
ALTER TABLE "LevelSubject" DROP CONSTRAINT "LevelSubject_streamId_fkey";

-- DropForeignKey
ALTER TABLE "Stream" DROP CONSTRAINT "Stream_levelId_fkey";

-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_streamId_fkey";

-- DropIndex
DROP INDEX "LevelSubject_levelId_streamId_subjectId_key";

-- DropIndex
DROP INDEX "TimetableSlot_classId_variant_weekday_idx";

-- DropIndex
DROP INDEX "TimetableSlot_roomId_variant_weekday_idx";

-- DropIndex
DROP INDEX "TimetableSlot_teacherId_variant_weekday_idx";

-- DropIndex
DROP INDEX "Unit_levelId_streamId_subjectId_order_idx";

-- AlterTable
ALTER TABLE "Class" DROP COLUMN "streamId";

-- AlterTable
ALTER TABLE "LevelSubject" DROP COLUMN "streamId",
ADD COLUMN     "specialityId" TEXT;

-- AlterTable
ALTER TABLE "SchoolYear" DROP COLUMN "ramadanEnd",
DROP COLUMN "ramadanStart";

-- AlterTable
ALTER TABLE "TimetableSlot" DROP COLUMN "variant";

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "streamId",
ADD COLUMN     "specialityId" TEXT;

-- DropTable
DROP TABLE "Stream";

-- DropEnum
DROP TYPE "TimetableVariant";

-- CreateTable
CREATE TABLE "Speciality" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,

    CONSTRAINT "Speciality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSpeciality" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "specialityId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "chosenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSpeciality_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Speciality_levelId_code_key" ON "Speciality"("levelId", "code");

-- CreateIndex
CREATE INDEX "StudentSpeciality_studentId_schoolYearId_idx" ON "StudentSpeciality"("studentId", "schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSpeciality_studentId_specialityId_schoolYearId_key" ON "StudentSpeciality"("studentId", "specialityId", "schoolYearId");

-- CreateIndex
CREATE UNIQUE INDEX "LevelSubject_levelId_specialityId_subjectId_key" ON "LevelSubject"("levelId", "specialityId", "subjectId");

-- CreateIndex
CREATE INDEX "TimetableSlot_classId_weekday_idx" ON "TimetableSlot"("classId", "weekday");

-- CreateIndex
CREATE INDEX "TimetableSlot_teacherId_weekday_idx" ON "TimetableSlot"("teacherId", "weekday");

-- CreateIndex
CREATE INDEX "TimetableSlot_roomId_weekday_idx" ON "TimetableSlot"("roomId", "weekday");

-- CreateIndex
CREATE INDEX "Unit_levelId_specialityId_subjectId_order_idx" ON "Unit"("levelId", "specialityId", "subjectId", "order");

-- AddForeignKey
ALTER TABLE "Speciality" ADD CONSTRAINT "Speciality_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSpeciality" ADD CONSTRAINT "StudentSpeciality_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSpeciality" ADD CONSTRAINT "StudentSpeciality_specialityId_fkey" FOREIGN KEY ("specialityId") REFERENCES "Speciality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSpeciality" ADD CONSTRAINT "StudentSpeciality_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelSubject" ADD CONSTRAINT "LevelSubject_specialityId_fkey" FOREIGN KEY ("specialityId") REFERENCES "Speciality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_specialityId_fkey" FOREIGN KEY ("specialityId") REFERENCES "Speciality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

