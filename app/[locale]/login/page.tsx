import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getBrand, getSchoolSettings, schoolName } from "@/lib/school";

export default async function LoginPage({ params }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("auth");
  const [settings, brand] = await Promise.all([getSchoolSettings(), getBrand()]);

  return (
    <main className="grid min-h-dvh bg-[var(--surface)] lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden min-h-dvh overflow-hidden lg:block">
        <Image
          src="/brand/campus-life.jpg"
          alt={
            locale === "ar"
              ? "تلاميذ بلانيت مونتيسوري"
              : locale === "en"
                ? "Planète Montessori students"
                : "Élèves de Planète Montessori"
          }
          fill
          sizes="54vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-t from-[var(--brand)]/85 via-[var(--brand)]/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white xl:p-14">
          <p className="max-w-lg text-3xl font-semibold leading-tight">
            {schoolName(settings, locale)}
          </p>
          <p className="mt-3 text-sm text-white/80">Targa · Agdal · MYSK — Marrakech</p>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center bg-[#f7fbfe] p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="inline-flex min-w-0 rounded-lg bg-[var(--brand)] px-3 py-2">
              <Image
                src={brand.logoPath}
                alt={schoolName(settings, locale)}
                width={270}
                height={79}
                className="h-9 w-auto min-w-0 object-contain"
                priority
              />
            </div>
            <LocaleSwitcher />
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm">
            <div className="mb-6 text-center">
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
      </section>
    </main>
  );
}
