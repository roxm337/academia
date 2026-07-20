"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { dashboardPathFor } from "@/lib/dal";
import { resolveLocale } from "@/i18n/routing";

export type LoginState = {
  error?: "invalidCredentials" | "accountDisabled" | "emailInvalid";
} | null;

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const locale = resolveLocale(String(formData.get("locale") ?? ""));

  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "emailInvalid" };

  const email = parsed.data.email.toLowerCase().trim();

  // Distinguish "disabled" from "wrong password" so the user gets a useful
  // message; the credential check itself still happens in authorize().
  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true, isActive: true },
  });
  if (user && !user.isActive) return { error: "accountDisabled" };

  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: user ? `/${locale}${dashboardPathFor(user.role)}` : `/${locale}`,
    });
  } catch (error) {
    // next-auth signals a successful redirect by throwing — rethrow it.
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") return { error: "invalidCredentials" };
      return { error: "invalidCredentials" };
    }
    throw error;
  }

  return null;
}

export async function logout(locale: string) {
  await signOut({ redirectTo: `/${resolveLocale(locale)}/login` });
}
