import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "./login-form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getSchoolSettings, schoolName } from "@/lib/school";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("auth");
  const settings = await getSchoolSettings();

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <LocaleSwitcher />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm">
          <div className="mb-6 text-center">
            <div
              className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl text-lg font-bold text-white"
              style={{ background: "var(--brand)" }}
              aria-hidden
            >
              {schoolName(settings, locale).charAt(0)}
            </div>
            <h1 className="text-xl font-semibold">
              {schoolName(settings, locale)}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t("loginSubtitle")}
            </p>
          </div>

          <LoginForm locale={locale} />
        </div>
      </div>
    </main>
  );
}
