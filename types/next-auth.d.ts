import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    role: Role;
    locale: string;
    nameAr: string;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      locale: string;
      nameAr: string;
    } & DefaultSession["user"];
  }
}

/**
 * What we put on the JWT.
 *
 * Augmenting the `JWT` interface does not merge under next-auth v5-beta —
 * `JWT extends Record<string, unknown>`, and neither the "next-auth/jwt" nor
 * the "@auth/core/jwt" specifier picks up the declaration, so every field
 * still reads as `unknown`. auth.ts narrows the token through this type once,
 * at the session callback, rather than casting field by field.
 */
export type AppToken = {
  id: string;
  role: Role;
  locale: string;
  nameAr: string;
};
