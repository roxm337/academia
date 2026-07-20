import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Bricolage_Grotesque, Cairo, Reem_Kufi } from "next/font/google";
import {
  BadgeCheck, CalendarClock, FileSpreadsheet, GraduationCap, Languages,
  LineChart, Notebook, ShieldCheck, Sigma, Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import "@/app/[locale]/landing.css";

// Loaded here, not in the root layout, so the dashboard never pays for them.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
});
const displayAr = Reem_Kufi({
  subsets: ["arabic"],
  weight: ["500", "600"],
  variable: "--font-display-ar",
});
const body = Cairo({
  subsets: ["latin", "arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-body",
});

const STATS = [
  { key: "students", value: "3" },
  { key: "teachers", value: "BSO" },
  { key: "classes", value: "2014" },
] as const;

export async function Landing({ locale }: { locale: string }) {
  const t = await getTranslations("landing");

  return (
    <div
      className={`landing ${display.variable} ${displayAr.variable} ${body.variable}`}
    >
      {/* ------------------------------------------------------------ nav */}
      <header className="hero-nav absolute inset-x-0 top-0 z-10">
        <div className="shell flex h-20 items-center gap-3 md:gap-6">
          <Image src="/brand/planete-montessori-logo.png" alt="Planète Montessori" width={254} height={74} className="h-12 w-auto" priority />

          <nav className="ms-auto hidden items-center gap-7 text-sm text-[#b8cbd0] md:flex">
            <a href="#roles" className="hover:text-white">{t("nav.roles")}</a>
            <a href="#school" className="hover:text-white">{t("nav.school")}</a>
            <a href="#faq" className="hover:text-white">{t("nav.faq")}</a>
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2 md:ms-0 md:gap-3">
            {/* Server-rendered locale swap — no JS on the marketing page. */}
            <div className="flex items-center text-sm">
              {routing.locales.map((l, i) => (
                <span key={l} className="flex items-center">
                  {i > 0 && <span className="mx-1.5 text-[#3a5665]">/</span>}
                  <Link
                    href="/"
                    locale={l}
                    lang={l}
                    className={
                      l === locale
                        ? "font-semibold text-[var(--brass)]"
                        : "text-[#7f97a3] hover:text-white"
                    }
                  >
                    {l === "ar" ? "العربية" : "FR"}
                  </Link>
                </span>
              ))}
            </div>
            <Link
              href="/login"
              className="btn btn-brass !h-10 !px-3 !text-xs md:!px-4 md:!text-sm"
            >
              {t("nav.login")}
            </Link>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------- hero */}
      <section className="hero pt-32!">
        <div className="shell hero-grid">
          <div className="hero-enter">
            <p className="eyebrow !text-[var(--brass)]">{t("hero.eyebrow")}</p>
            <h1 className="h1 mt-5">{t("hero.title")}</h1>
            <p className="lead">{t("hero.lead")}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-brass">
                {t("hero.ctaPrimary")}
              </Link>
              <a href="#school" className="btn btn-quiet">
                {t("hero.ctaSecondary")}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- stats */}
      <section className="band-chaux !py-0">
        <div className="shell grid grid-cols-2 divide-x divide-[#dde4e0] md:grid-cols-4 rtl:divide-x-reverse">
          {STATS.map((s) => (
            <div key={s.key} className="px-4 py-9 text-center">
              <p className="figures display text-3xl">{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-[var(--muted-ink)]">
                {t(`stats.${s.key}`)}
              </p>
            </div>
          ))}
          <div className="px-4 py-9 text-center">
            <p className="display text-3xl text-[var(--brand-blue)]">
              {t("stats.languagesValue")}
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-[var(--muted-ink)]">
              {t("stats.languages")}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- roles */}
      <section id="roles">
        <div className="shell">
          <div className="reveal mb-12 max-w-2xl">
            <p className="eyebrow">{t("roles.eyebrow")}</p>
            <h2 className="h2 mt-4">{t("roles.title")}</h2>
            <p className="lead mt-4 text-[var(--muted-ink)]">{t("roles.lead")}</p>
          </div>

          <div className="tiles reveal">
            {/* Parent leads the tessellation: they are the daily reader. */}
            <div className="tile-wide">
              <Users className="tile-glyph" strokeWidth={1.25} />
              <h3 className="h3">{t("roles.parent")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {t("roles.parentText")}
              </p>
            </div>
            <div className="tile-wide">
              <Notebook className="tile-glyph" strokeWidth={1.25} />
              <h3 className="h3">{t("roles.teacher")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {t("roles.teacherText")}
              </p>
            </div>

            <div className="tile">
              <LineChart className="tile-glyph" strokeWidth={1.25} />
              <h3 className="h3">{t("roles.director")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {t("roles.directorText")}
              </p>
            </div>
            <div className="tile">
              <ShieldCheck className="tile-glyph" strokeWidth={1.25} />
              <h3 className="h3">{t("roles.surveillant")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {t("roles.surveillantText")}
              </p>
            </div>
            <div className="tile">
              <GraduationCap className="tile-glyph" strokeWidth={1.25} />
              <h3 className="h3">{t("roles.student")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {t("roles.studentText")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- school */}
      <section id="school" className="band-chaux">
        <div className="shell">
          <div className="reveal mb-12 max-w-2xl">
            <p className="eyebrow">{t("school.eyebrow")}</p>
            <h2 className="h2 mt-4">{t("school.title")}</h2>
            <p className="lead mt-4 text-[var(--muted-ink)]">{t("school.lead")}</p>
          </div>

          <div className="split reveal">
            <article className="plate plate-accent">
              <Sigma className="size-7 text-[var(--brass)]" strokeWidth={1.5} />
              <h3 className="h3 mt-4">{t("school.gradesTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6269]">
                {t("school.gradesText")}
              </p>
              <p className="figures mt-5 rounded-lg bg-white/70 px-4 py-3 text-center text-sm text-[var(--ink)]">
                {t("school.formula")}
              </p>
            </article>

            <article className="plate">
              <FileSpreadsheet className="size-7 text-[var(--brand-blue)]" strokeWidth={1.5} />
              <h3 className="h3 mt-4">{t("school.massarTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6269]">
                {t("school.massarText")}
              </p>
            </article>

            <article className="plate">
              <Languages className="size-7 text-[var(--brand-cyan)]" strokeWidth={1.5} />
              <h3 className="h3 mt-4">{t("school.bilingualTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6269]">
                {t("school.bilingualText")}
              </p>
            </article>

            <article className="plate">
              <CalendarClock className="size-7 text-[var(--brand-blue)]" strokeWidth={1.5} />
              <h3 className="h3 mt-4">{t("school.ramadanTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6269]">
                {t("school.ramadanText")}
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- flow */}
      <section className="band-dark">
        <div className="shell">
          <div className="reveal mb-12 max-w-2xl">
            <p className="eyebrow !text-[var(--brass)]">{t("flow.eyebrow")}</p>
            <h2 className="h2 mt-4 text-white">{t("flow.title")}</h2>
            <p className="lead mt-4 text-[#b8cbd0]">{t("flow.lead")}</p>
          </div>

          {/* Numbered because this genuinely is a sequence — the order is the point. */}
          <ol className="steps reveal">
            {["step1", "step2", "step3", "step4"].map((s) => (
              <li key={s} className="step">
                <h3 className="h3 text-white">{t(`flow.${s}`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8ea6b0]">
                  {t(`flow.${s}Text`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ faq */}
      <section id="faq">
        <div className="shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="reveal">
            <p className="eyebrow">{t("faq.eyebrow")}</p>
            <h2 className="h2 mt-4">{t("faq.title")}</h2>
          </div>

          <div className="reveal">
            {["1", "2", "3", "4"].map((n) => (
              <details key={n} className="qa">
                <summary>{t(`faq.q${n}`)}</summary>
                <p>{t(`faq.a${n}`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ cta */}
      <section className="band-chaux">
        <div className="shell text-center">
          <BadgeCheck
            className="mx-auto size-9 text-[var(--brass)]"
            strokeWidth={1.4}
          />
          <h2 className="h2 mt-5">{t("cta.title")}</h2>
          <p className="lead mx-auto mt-4 max-w-md text-[var(--muted-ink)]">
            {t("cta.lead")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn btn-ink">
              {t("cta.button")}
            </Link>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- footer */}
      <footer className="band-dark py-14!">
        <div className="shell flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Image src="/brand/planete-montessori-logo.png" alt="Planète Montessori" width={254} height={74} className="h-12 w-auto" />
            <p className="mt-2 max-w-xs text-sm text-[#8ea6b0]">
              {t("footer.tagline")}
            </p>
          </div>
          <div className="text-sm text-[#8ea6b0] md:text-end">
            <p>{t("footer.address")}</p>
            <p className="mt-1">
              © {new Date().getFullYear()} — {t("footer.rights")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
