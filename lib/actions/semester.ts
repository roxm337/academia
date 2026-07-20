"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/dal";
import { audit } from "@/lib/audit";
import { finalizeSemester, unfinalizeSemester } from "@/lib/council-archive";
import type { ActionState } from "@/lib/actions/structure";

const toggleSchema = z.object({
  id: z.string().min(1),
  value: z.enum(["true", "false"]),
});

/**
 * Lock or unlock a semester. A locked semester freezes its gradebook — no item,
 * score or appreciation can change — so a bulletin can't shift under a family
 * after it's been handed out.
 *
 * Locking also **archives** every class's results (SemesterResult, isFinal).
 * The two go together deliberately: a semester that is closed but whose
 * bulletins are still recomputed from live data would still drift when a
 * student changes class or a coefficient is corrected next year.
 */
export async function lockSemester(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const lock = parsed.data.value === "true";

  // Archive BEFORE flipping the flag: snapshotting refuses to run against a
  // locked semester, and a failure here must leave the semester open rather
  // than closed with nothing archived.
  const archived = lock ? await finalizeSemester(parsed.data.id) : 0;
  if (!lock) await unfinalizeSemester(parsed.data.id);

  const updated = await prisma.semester.update({
    where: { id: parsed.data.id },
    data: { isLocked: lock, lockedAt: lock ? new Date() : null },
  });

  await audit({
    actorId: actor.id,
    action: lock ? "SEMESTER_LOCK" : "SEMESTER_UNLOCK",
    entity: "Semester",
    entityId: updated.id,
    after: lock ? { archivedResults: archived } : undefined,
  });

  revalidatePath("/[locale]/(dashboard)/director/grades", "page");
  revalidatePath("/[locale]/(dashboard)/director/council", "page");
  return { ok: true };
}

/**
 * Publish (or hide) a semester's grades. Until published, students and parents
 * see nothing — grade entry happens out of their view, and the school controls
 * the moment results become visible.
 */
export async function publishSemester(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("DIRECTOR");
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const publish = parsed.data.value === "true";
  const updated = await prisma.semester.update({
    where: { id: parsed.data.id },
    data: { gradesPublishedAt: publish ? new Date() : null },
  });

  await audit({
    actorId: actor.id,
    action: publish ? "GRADES_PUBLISH" : "GRADES_UNPUBLISH",
    entity: "Semester",
    entityId: updated.id,
  });

  revalidatePath("/[locale]/(dashboard)/director/grades", "page");
  return { ok: true };
}
