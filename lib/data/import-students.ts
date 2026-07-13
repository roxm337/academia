import "server-only";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validateRows, type ImportField, type SheetData } from "@/lib/massar";

export type ImportOutcome = {
  imported: number;
  skipped: number;
  invalidRows: number;
  duplicates: number;
};

/**
 * The import itself, kept out of the Server Action so it can be exercised
 * directly (and so the action stays a thin auth + revalidate wrapper).
 *
 * Rows are validated from scratch here: the sheet and mapping come back from
 * the browser, so nothing about them is trusted. A bad row is skipped and
 * counted, never fatal — one malformed line must not cost the director the
 * other 199.
 */
export async function importStudents(input: {
  sheet: SheetData;
  mapping: Record<number, ImportField | "">;
  classId: string | null;
  actorId: string;
  studentEmailDomain?: string;
}): Promise<ImportOutcome> {
  const { sheet, mapping, classId } = input;
  const domain = input.studentEmailDomain ?? "eleve.academia.ma";

  const parsed = validateRows(sheet, mapping);
  const candidates = parsed.filter((r) => r.errors.length === 0);
  const invalidRows = parsed.length - candidates.length;

  // One round-trip rather than one per row.
  const existing = await prisma.studentProfile.findMany({
    where: { codeMassar: { in: candidates.map((r) => r.values.codeMassar!) } },
    select: { codeMassar: true },
  });
  const alreadyThere = new Set(existing.map((e) => e.codeMassar));

  const toCreate = candidates.filter(
    (r) => !alreadyThere.has(r.values.codeMassar!),
  );

  let imported = 0;

  for (const row of toCreate) {
    const v = row.values;
    const codeMassar = v.codeMassar!;

    // Hash BEFORE opening the transaction. bcrypt is ~80ms of pure CPU, and
    // doing it inside would hold a database transaction open for the duration —
    // 200 of those is what turned a 200-row import into a 16-second request.
    //
    // Cost 8 (not 10) is deliberate: this is a random 12-character placeholder
    // the pupil never types. It is replaced the first time the school issues a
    // real password. Staff and parent accounts still hash at cost 10.
    const passwordHash = await bcrypt.hash(
      randomBytes(9).toString("base64url"),
      8,
    );

    // A Massar export often carries names in one script only. Mirror rather
    // than leave a required column blank.
    const lastNameFr = v.lastNameFr ?? v.lastNameAr ?? "";
    const firstNameFr = v.firstNameFr ?? v.firstNameAr ?? "";
    const lastNameAr = v.lastNameAr ?? lastNameFr;
    const firstNameAr = v.firstNameAr ?? firstNameFr;

    try {
      await prisma.$transaction(async (tx) => {
        const student = await tx.studentProfile.create({
          data: {
            codeMassar,
            cne: v.cne || null,
            birthDate: row.birthDate!,
            birthPlaceAr: v.birthPlaceAr || null,
            birthPlaceFr: v.birthPlaceFr || null,
            gender: row.gender,
            user: {
              create: {
                email: `${codeMassar.toLowerCase()}@${domain}`,
                passwordHash,
                role: "STUDENT",
                locale: "ar",
                firstNameAr,
                lastNameAr,
                firstNameFr,
                lastNameFr,
              },
            },
            ...(classId ? { enrollments: { create: { classId } } } : {}),
          },
        });

        // Reuse a guardian by phone, so siblings in one file land under a single
        // parent rather than one guardian each.
        if (v.guardianName && v.guardianPhone) {
          const phone = v.guardianPhone.trim();
          let guardian = await tx.guardian.findFirst({ where: { phone } });

          if (!guardian) {
            const parts = v.guardianName.trim().split(/\s+/);
            const gLast = parts[0] ?? v.guardianName;
            const gFirst = parts.slice(1).join(" ") || gLast;
            guardian = await tx.guardian.create({
              data: {
                firstNameAr: gFirst,
                lastNameAr: gLast,
                firstNameFr: gFirst,
                lastNameFr: gLast,
                phone,
                email: v.guardianEmail || null,
              },
            });
          }

          await tx.studentGuardian.create({
            data: {
              studentId: student.id,
              guardianId: guardian.id,
              relation: "TUTOR",
              isPrimary: true,
            },
          });
        }
      });
      imported++;
    } catch {
      // Lost a race on a duplicate Code Massar — skip, don't abort the file.
    }
  }

  return {
    imported,
    skipped: parsed.length - imported,
    invalidRows,
    duplicates: alreadyThere.size,
  };
}
