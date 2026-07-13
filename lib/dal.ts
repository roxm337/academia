import "server-only";

import { cache } from "react";
import { getLocale } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import type { Role } from "@/lib/generated/prisma/enums";

/**
 * Data Access Layer.
 *
 * proxy.ts only does an *optimistic* cookie check — it never touches the DB and
 * is not a security boundary. Every page, Server Action and Route Handler must
 * call verifySession()/requireRole() here. Server Actions are reachable by
 * direct POST, so a page-level check does NOT protect the actions it renders.
 */

export type SessionUser = {
  id: string;
  role: Role;
  email: string;
  name: string;
  nameAr: string;
  locale: string;
};

/** Returns the session user, or null. cache() dedupes it within one render. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    role: session.user.role,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    nameAr: session.user.nameAr ?? "",
    locale: session.user.locale ?? "fr",
  };
});

/** Requires *any* authenticated user; redirects to the localized login page. */
export const verifySession = cache(async (): Promise<SessionUser> => {
  const user = await getSessionUser();
  if (!user) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
  }
  return user!;
});

/** Requires one of `roles`. Sends an authenticated-but-wrong-role user home. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await verifySession();
  if (!roles.includes(user.role)) {
    const locale = await getLocale();
    redirect({ href: dashboardPathFor(user.role), locale });
  }
  return user;
}

/** Where each role lands after login. */
export function dashboardPathFor(role: Role): string {
  switch (role) {
    case "DIRECTOR":
      return "/director";
    case "SURVEILLANT":
      return "/surveillant";
    case "TEACHER":
      return "/teacher";
    case "STUDENT":
      return "/student";
    case "PARENT":
      return "/parent";
  }
}

/**
 * A parent may only ever read their own children. Every parent-scoped query
 * must be filtered through this — never trust a studentId from the client.
 */
export const childrenOfParent = cache(async (userId: string) => {
  const guardian = await prisma.guardian.findUnique({
    where: { userId },
    select: {
      students: {
        select: {
          student: {
            select: {
              id: true,
              codeMassar: true,
              user: {
                select: {
                  firstNameAr: true, lastNameAr: true,
                  firstNameFr: true, lastNameFr: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return guardian?.students.map((s) => s.student) ?? [];
});

/** Throws unless the parent actually guards this student. */
export async function assertParentOfStudent(userId: string, studentId: string) {
  const children = await childrenOfParent(userId);
  if (!children.some((c) => c.id === studentId)) {
    throw new Error("Forbidden");
  }
}

/** The class+subject pairs a teacher owns. Used to scope every teacher query. */
export const teacherAssignments = cache(async (userId: string) => {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      assignments: {
        select: { classId: true, subjectId: true },
      },
    },
  });
  return profile;
});

/** Throws unless this teacher is assigned to that class+subject. */
export async function assertTeacherOwns(
  userId: string,
  classId: string,
  subjectId: string,
) {
  const profile = await teacherAssignments(userId);
  const owns = profile?.assignments.some(
    (a) => a.classId === classId && a.subjectId === subjectId,
  );
  if (!owns) {
    throw new Error("Forbidden");
  }
}
