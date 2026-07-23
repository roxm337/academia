import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Bricolage_Grotesque, Cairo, Reem_Kufi } from "next/font/google";
import {
  Atom, BadgeCheck, Backpack, BookOpen, CalendarClock, ChevronDown, Cpu, FileSpreadsheet,
  Globe, GraduationCap, Languages, Leaf, LineChart, Notebook, Palette,
  ShieldCheck, Sigma, Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getBrand } from "@/lib/school";
import { landingData } from "@/lib/data/landing";
import { localized } from "@/lib/school";
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

/**
 * Tints for the card grids. Cycled by index so a set of cards reads as related
 * but distinct — the same trick a prospectus uses for its section dividers.
 */
const TINTS = [
  { tint: "#eef6ff", accent: "var(--brand-blue)" },
  { tint: "#eefaf4", accent: "var(--brand-cyan)" },
  { tint: "#fff8ea", accent: "var(--brass)" },
  { tint: "#fdf0ee", accent: "var(--coral)" },
] as const;
const tintAt = (i: number) => TINTS[i % TINTS.length];

/**
 * Campus photographs. Real images only — the section renders whatever is listed
 * and is omitted entirely below two, so an empty or thin gallery never ships.
 * Drop more into public/brand/gallery/ and add them here to grow it.
 */
const GALLERY = [
  "/brand/campus-life.jpg",
  "/brand/hero-campus-v2.webp",
] as const;

/**
 * Testimonials.
 *
 * Attributed to roles, not to invented named individuals, and shown with a
 * monogram rather than a stock face: these are illustrative until the school
 * supplies real, consented quotes. The content lives in the message files so it
 * can be replaced without a deploy.
 */
const VOICES = [
  { key: "parent", mono: "P", accent: "var(--brand-blue)" },
  { key: "teacher", mono: "E", accent: "var(--brand-cyan)" },
  { key: "student", mono: "É", accent: "var(--brass)" },
] as const;

/**
 * An icon per spécialité and per cycle.
 *
 * Not decoration: on a grid of eight cards the glyph is what the eye sorts by
 * before it reads a word. Eight identical sigmas would be worse than none —
 * they promise a distinction they do not deliver.
 */
const SPECIALITY_ICONS: Record<string, typeof Sigma> = {
  SPE_MATHS: Sigma,
  SPE_NSI: Cpu,
  SPE_PC: Atom,
  SPE_SVT: Leaf,
  SPE_SES: LineChart,
  SPE_HGGSP: Globe,
  SPE_HLP: BookOpen,
  SPE_LLCER: Languages,
};

/**
 * Short display label for a level pill.
 *
 * The stored names are inconsistent by cycle (élémentaire keeps "CP", collège
 * spells out "Sixième") and the Arabic ones run to four words, which wraps a
 * pill row onto four lines. Level codes are the same in every language a French
 * school operates in — a parent in Marrakech says "Terminale", not a
 * translation of it — so the code is both the shortest and the most correct
 * thing to show.
 */
const LEVEL_LABELS: Record<string, string> = {
  CP: "CP", CE1: "CE1", CE2: "CE2", CM1: "CM1", CM2: "CM2",
  "6E": "6e", "5E": "5e", "4E": "4e", "3E": "3e",
  "2NDE": "2nde", "1RE": "1re", TLE: "Tle",
};

const CYCLE_ICONS: Record<string, typeof Sigma> = {
  ELEMENTAIRE: Palette,
  COLLEGE: Backpack,
  LYCEE: GraduationCap,
};

export async function Landing({ locale }: { locale: string }) {
  const t = await getTranslations("landing");
  const [brand, data] = await Promise.all([getBrand(), landingData()]);

  // Every figure below is a live count. The page used to ship "3", "BSO" and
  // "2014" as placeholders, which is the sort of thing that survives to
  // production and quietly makes a real school look careless.
  const levelCount = data.cycles.reduce((n, c) => n + c.levels.length, 0);

  const figures = [
    { key: "students", value: data.counts.students, Icon: Users },
    { key: "teachers", value: data.counts.teachers, Icon: GraduationCap },
    { key: "classes", value: data.counts.classes, Icon: Notebook },
    { key: "subjects", value: data.counts.subjects, Icon: Sigma },
  ] as const;

  return (
    <div
      className={`landing ${display.variable} ${displayAr.variable} ${body.variable}`}
    >
      {/* ------------------------------------------------------------ nav */}
      <header className="hero-nav absolute inset-x-0 top-0 z-10">
        <div className="shell flex h-20 items-center gap-3 md:gap-6">
          <Link href="/" className="brand-lockup" aria-label={t("hero.title")}>
            <span className="brand-chip">
              <Image
                src={brand.logoPath}
                alt={t("hero.title")}
                width={270}
                height={79}
                className="h-7 w-auto"
                priority
              />
            </span>
          </Link>

          <nav className="hero-nav-links ms-auto hidden items-center gap-7 text-sm lg:flex">
            <a href="#cycles" className="hover:text-white">{t("cycles.eyebrow")}</a>
            <a href="#specialites" className="hover:text-white">{t("specialities.eyebrow")}</a>
            <a href="#roles" className="hover:text-white">{t("nav.roles")}</a>
            <a href="#school" className="hover:text-white">{t("nav.school")}</a>
            <a href="#faq" className="hover:text-white">{t("nav.faq")}</a>
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-2 md:ms-0 md:gap-3">
            {/* Server-rendered locale swap — no JS on the marketing page. */}
            <div className="locale-links flex items-center text-sm">
              {routing.locales.map((l, i) => (
                <span key={l} className="flex items-center">
                  {i > 0 && <span className="locale-separator mx-1.5">/</span>}
                  <Link
                    href="/"
                    locale={l}
                    lang={l}
                    className={
                      l === locale
                        ? "font-semibold text-[var(--brass)]"
                        : "locale-inactive hover:text-white"
                    }
                  >
                    {l === "ar" ? "العربية" : l.toUpperCase()}
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
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-enter">
            <p className="eyebrow !text-[var(--brand-cyan)]">{t("hero.eyebrow")}</p>
            <h1 className="h1 mt-5">{t("hero.title")}</h1>
            <p className="lead">{t("hero.lead")}</p>
            <div className="hero-actions mt-9 flex flex-wrap gap-3">
              <Link href="/login" className="btn btn-brass">
                {t("hero.ctaPrimary")}
              </Link>
              <a href="#cycles" className="btn btn-quiet">
                {t("hero.ctaSecondary")}
              </a>
            </div>

            {/* The demo puts an avatar stack and a 5.0 star rating here. A
                school cannot award itself either, so the same slot carries
                figures that are simply true. */}
            <div className="proof">
              <p>
                <span className="proof-figure">{data.counts.students}</span>{" "}
                <span className="proof-label">{t("figures.students")}</span>
              </p>
              <p>
                <span className="proof-figure">{levelCount}</span>{" "}
                <span className="proof-label">{t("hero.levels")}</span>
              </p>
              {data.year ? (
                <p className="proof-label">
                  {t("hero.year", { year: data.year.label })}
                </p>
              ) : null}
            </div>
          </div>

          {/* Decorative: the photograph carries no information the text does
              not already state, so it is hidden from assistive tech. */}
          <div className="hero-visual" aria-hidden="true">
            <span className="hero-aura hero-aura-a" />
            <span className="hero-aura hero-aura-b" />
            <span className="hero-spark hero-spark-a" />
            <span className="hero-spark hero-spark-b" />
            <span className="hero-spark hero-spark-c" />
            <span className="hero-dot dot-brass" />
            <span className="hero-dot dot-blue" />
            <span className="hero-ring" />
            <span className="hero-disc" />
            <span className="hero-photo">
              <Image
                src="/brand/campus-life.jpg"
                alt=""
                width={900}
                height={900}
                className="h-full w-full object-cover"
                priority
              />
            </span>

            <span className="float-card float-a" style={{ "--accent": "var(--brand-cyan)" } as React.CSSProperties}>
              <span className="fc-chip">
                <GraduationCap className="size-5" strokeWidth={1.75} />
              </span>
              <span>
                <span className="fc-figure block">{data.counts.teachers}</span>
                <span className="fc-label">{t("figures.teachers")}</span>
              </span>
            </span>

            <span className="float-card float-b" style={{ "--accent": "var(--brand-blue)" } as React.CSSProperties}>
              <span className="fc-chip">
                <Users className="size-5" strokeWidth={1.75} />
              </span>
              <span>
                <span className="fc-figure block">{data.counts.students}</span>
                <span className="fc-label">{t("figures.students")}</span>
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- figures */}
      <section className="stats-strip band-chaux">
        <div className="shell">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {figures.map((f, i) => (
              <div
                key={f.key}
                className="figure-card"
                style={{ "--tint": tintAt(i).tint, "--accent": tintAt(i).accent } as React.CSSProperties}
              >
                <span className="chip">
                  <f.Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <p className="figure">{f.value}</p>
                <p className="mt-1.5 text-sm text-[var(--muted-ink)]">
                  {t(`figures.${f.key}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- cycles */}
      <section id="cycles">
        <div className="shell">
          <div className="section-head reveal">
            <p className="eyebrow">{t("cycles.eyebrow")}</p>
            <h2 className="h2 mt-4">{t("cycles.title")}</h2>
            <p className="lead text-[var(--muted-ink)]">{t("cycles.lead")}</p>
          </div>

          <div className="card-grid cycle-grid reveal">
            {data.cycles.map((cycle, i) => (
              <article
                key={cycle.id}
                className="info-card cycle-card"
                style={{ "--tint": tintAt(i).tint, "--accent": tintAt(i).accent } as React.CSSProperties}
              >
                <span className="card-index" aria-hidden="true">0{i + 1}</span>
                {(() => {
                  const Icon = CYCLE_ICONS[cycle.kind] ?? Backpack;
                  return <Icon className="card-glyph" strokeWidth={1.5} aria-hidden="true" />;
                })()}
                <h3 className="h3">{localized(cycle, locale)}</h3>
                <div className="code-row">
                  {cycle.levels.map((lv) => (
                    <span key={lv.id} className="code-pill" dir="ltr">
                      {LEVEL_LABELS[lv.code] ?? lv.code}
                    </span>
                  ))}
                </div>
                <p className="card-meta">
                  {t("cycles.levelCount", { count: cycle.levels.length })}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- spécialités */}
      {data.specialities.length > 0 ? (
        <section id="specialites" className="band-chaux">
          <div className="shell">
            <div className="section-head reveal">
              <p className="eyebrow">{t("specialities.eyebrow")}</p>
              <h2 className="h2 mt-4">{t("specialities.title")}</h2>
              <p className="lead text-[var(--muted-ink)]">{t("specialities.lead")}</p>
            </div>

            <div className="card-grid speciality-grid reveal">
              {data.specialities.map((sp, i) => (
                <article
                  key={sp.id}
                  className="info-card speciality-card"
                  style={{ "--tint": tintAt(i).tint, "--accent": tintAt(i).accent } as React.CSSProperties}
                >
                  <span className="speciality-orbit" aria-hidden="true" />
                  {(() => {
                    const Icon = SPECIALITY_ICONS[sp.code] ?? Sigma;
                    return <Icon className="card-glyph" strokeWidth={1.5} aria-hidden="true" />;
                  })()}
                  <h3 className="h3">{localized(sp, locale)}</h3>
                  <p className="card-meta speciality-meta">
                    <span className="status-dot" aria-hidden="true" />
                    {t("specialities.badge")}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------- subjects */}
      <section id="subjects">
        <div className="shell">
          <div className="section-head reveal">
            <p className="eyebrow">{t("subjects.eyebrow")}</p>
            <h2 className="h2 mt-4">{t("subjects.title")}</h2>
            <p className="lead text-[var(--muted-ink)]">{t("subjects.lead")}</p>
          </div>

          <div className="curriculum-grid reveal">
            {data.cycles
              .filter((c) => c.subjects.length > 0)
              .map((cycle, i) => (
                <article
                  key={cycle.id}
                  className="curriculum-card"
                  style={{ "--accent": tintAt(i).accent, "--tint": tintAt(i).tint } as React.CSSProperties}
                >
                  <div className="curriculum-card-head">
                    <h3 className="h3">{localized(cycle, locale)}</h3>
                    <span className="curriculum-count" aria-hidden="true">
                      {cycle.subjects.length}
                    </span>
                  </div>
                  <div className="chip-set">
                    {cycle.subjects.map((sub) => (
                      <span key={sub.id} className="subject-chip">
                        {localized(sub, locale)}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
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

          <div className="tiles role-tiles reveal">
            {/* Parent leads the tessellation: they are the daily reader. */}
            <div className="tile-wide role-tile role-parent">
              <span className="tile-icon"><Users className="tile-glyph" strokeWidth={1.25} /></span>
              <span className="tile-kicker">01</span>
              <h3 className="h3">{t("roles.parent")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {t("roles.parentText")}
              </p>
            </div>
            <div className="tile-wide role-tile role-teacher">
              <span className="tile-icon"><Notebook className="tile-glyph" strokeWidth={1.25} /></span>
              <span className="tile-kicker">02</span>
              <h3 className="h3">{t("roles.teacher")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {t("roles.teacherText")}
              </p>
            </div>

            <div className="tile role-tile">
              <span className="tile-icon"><LineChart className="tile-glyph" strokeWidth={1.25} /></span>
              <span className="tile-kicker">03</span>
              <h3 className="h3">{t("roles.director")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {t("roles.directorText")}
              </p>
            </div>
            <div className="tile role-tile">
              <span className="tile-icon"><ShieldCheck className="tile-glyph" strokeWidth={1.25} /></span>
              <span className="tile-kicker">04</span>
              <h3 className="h3">{t("roles.surveillant")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {t("roles.surveillantText")}
              </p>
            </div>
            <div className="tile role-tile">
              <span className="tile-icon"><GraduationCap className="tile-glyph" strokeWidth={1.25} /></span>
              <span className="tile-kicker">05</span>
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

          <div className="split experience-grid reveal">
            <article className="plate plate-accent experience-card experience-featured">
              <span className="experience-icon"><Sigma className="size-7 text-[var(--brass)]" strokeWidth={1.5} /></span>
              <h3 className="h3 mt-4">{t("school.gradesTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6269]">
                {t("school.gradesText")}
              </p>
              <p className="figures mt-5 rounded-lg bg-white/70 px-4 py-3 text-center text-sm text-[var(--ink)]">
                {t("school.formula")}
              </p>
            </article>

            <article className="plate experience-card">
              <span className="experience-icon"><FileSpreadsheet className="size-7 text-[var(--brand-blue)]" strokeWidth={1.5} /></span>
              <h3 className="h3 mt-4">{t("school.massarTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6269]">
                {t("school.massarText")}
              </p>
            </article>

            <article className="plate experience-card">
              <span className="experience-icon"><Languages className="size-7 text-[var(--brand-cyan)]" strokeWidth={1.5} /></span>
              <h3 className="h3 mt-4">{t("school.bilingualTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6269]">
                {t("school.bilingualText")}
              </p>
            </article>

            <article className="plate experience-card">
              <span className="experience-icon"><CalendarClock className="size-7 text-[var(--brand-blue)]" strokeWidth={1.5} /></span>
              <h3 className="h3 mt-4">{t("school.familiesTitle")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#4d6269]">
                {t("school.familiesText")}
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- campus */}
      {GALLERY.length >= 2 ? (
        <section id="campus">
          <div className="shell">
            <div className="section-head reveal">
              <p className="eyebrow">{t("campus.eyebrow")}</p>
              <h2 className="h2 mt-4">{t("campus.title")}</h2>
              <p className="lead text-[var(--muted-ink)]">{t("campus.lead")}</p>
            </div>
            <div className="gallery-grid reveal">
              {GALLERY.map((src, i) => (
                <figure key={src} className="gallery-item">
                  <Image
                    src={src}
                    alt=""
                    width={900}
                    height={675}
                    sizes={i === 0 ? "(min-width: 60rem) 50vw, 100vw" : "(min-width: 60rem) 25vw, 100vw"}
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------------- flow */}
      <section className="band-dark flow-section">
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
                <span className="step-node" aria-hidden="true" />
                <h3 className="h3 text-white">{t(`flow.${s}`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#8ea6b0]">
                  {t(`flow.${s}Text`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------------- voices */}
      <section id="voices" className="band-chaux">
        <div className="shell">
          <div className="section-head reveal">
            <p className="eyebrow">{t("voices.eyebrow")}</p>
            <h2 className="h2 mt-4">{t("voices.title")}</h2>
            <p className="lead text-[var(--muted-ink)]">{t("voices.lead")}</p>
          </div>
          <div className="voice-grid reveal">
            {VOICES.map((v) => (
              <figure
                key={v.key}
                className="voice-card"
                style={{ "--accent": v.accent } as React.CSSProperties}
              >
                <blockquote className="voice-quote">
                  {t(`voices.${v.key}Quote`)}
                </blockquote>
                <figcaption className="voice-who">
                  <span className="voice-mono" aria-hidden="true">{v.mono}</span>
                  <span className="voice-role">{t(`voices.${v.key}Role`)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ faq */}
      <section id="faq" className="faq">
        <div className="shell grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="reveal">
            <p className="eyebrow">{t("faq.eyebrow")}</p>
            <h2 className="h2 mt-4">{t("faq.title")}</h2>
            <p className="lead mt-4 text-[var(--muted-ink)]">{t("faq.lead")}</p>

            <figure className="faq-figure">
              <Image
                src="/faqs.png"
                alt=""
                width={1063}
                height={1137}
                sizes="(min-width: 68rem) 22rem, 90vw"
              />
            </figure>
          </div>

          <div className="faq-list reveal">
            {["1", "2", "3", "4"].map((n, i) => (
              // The first answer starts open, as in any good FAQ: a column of
              // identical closed rows tells the reader nothing about what is
              // inside them.
              <details key={n} className="qa" open={i === 0}>
                <summary>
                  <span className="qa-number" aria-hidden="true">0{n}</span>
                  <span className="qa-question">{t(`faq.q${n}`)}</span>
                  <ChevronDown className="qa-chevron" strokeWidth={1.75} aria-hidden="true" />
                </summary>
                <p>{t(`faq.a${n}`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ cta */}
      <section className="band-chaux final-cta">
        <div className="shell">
          <div className="cta-panel text-center">
            <span className="cta-orbit cta-orbit-a" aria-hidden="true" />
            <span className="cta-orbit cta-orbit-b" aria-hidden="true" />
            <span className="cta-glow" aria-hidden="true" />
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
        </div>
      </section>

      {/* --------------------------------------------------------- footer */}
      <footer className="band-dark py-14!">
        <div className="shell flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Image src={brand.logoPath} alt={t("hero.title")} width={270} height={79} className="h-12 w-auto" />
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
