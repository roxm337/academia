import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/generated/prisma/enums";
import type { AppToken } from "@/types/next-auth";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // JWT strategy is required for the Credentials provider.
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  trustHost: true,
  pages: { signIn: "/fr/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase().trim() },
        });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // Minimal payload only — no PII beyond what the UI needs (see DAL).
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          locale: user.locale,
          name: `${user.firstNameFr} ${user.lastNameFr}`,
          nameAr: `${user.firstNameAr} ${user.lastNameAr}`,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as Role;
        token.locale = user.locale as string;
        token.nameAr = user.nameAr as string;
      }
      return token;
    },
    session({ session, token }) {
      // See types/next-auth.d.ts: JWT augmentation doesn't merge in v5-beta,
      // so the token is narrowed here once instead of cast field by field.
      const t = token as unknown as AppToken;
      session.user.id = t.id;
      session.user.role = t.role;
      session.user.locale = t.locale;
      session.user.nameAr = t.nameAr;
      return session;
    },
  },
});
