import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  UserCheck,
  Wallet,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/field";
import { childrenOfParent, requireRole } from "@/lib/dal";
import { activeClassOfStudentId } from "@/lib/data/timetable";

const ACTIONS = [
  { key: "timetable", href: "/parent/timetable", icon: CalendarDays },
  { key: "grades", href: "/parent/grades", icon: ClipboardList },
  { key: "homework", href: "/parent/homework", icon: BookOpen },
  { key: "attendance", href: "/parent/attendance", icon: UserCheck },
  { key: "fees", href: "/parent/fees", icon: Wallet },
] as const;

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("PARENT");
  const t = await getTranslations("childrenPage");
  const children = await childrenOfParent(user.id);
  const rows = await Promise.all(
    children.map(async (child) => ({
      ...child,
      klass: await activeClassOfStudentId(child.id),
    })),
  );

  const nameOf = (child: (typeof children)[number]) =>
    locale === "ar"
      ? `${child.user.firstNameAr} ${child.user.lastNameAr}`
      : `${child.user.firstNameFr} ${child.user.lastNameFr}`;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {rows.length === 0 ? (
        <EmptyState message={t("none")} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((child) => {
            const name = nameOf(child);
            const initials = name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join("");

            return (
              <Card key={child.id} className="overflow-hidden p-0">
                <div className="flex items-start gap-4 border-b border-[var(--line)] p-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-sm font-semibold text-white">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold text-[var(--ink)]">{name}</h2>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="eyebrow">{t("class")}</dt>
                        <dd className="mt-1 font-medium text-[var(--ink-2)]">{child.klass?.name ?? t("noClass")}</dd>
                      </div>
                      <div>
                        <dt className="eyebrow">{t("massar")}</dt>
                        <dd className="code mt-1 text-[var(--ink-2)]" dir="ltr">{child.codeMassar}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
                <nav className="grid grid-cols-2 divide-x divide-y divide-[var(--line)] sm:grid-cols-5 sm:divide-y-0 rtl:divide-x-reverse" aria-label={name}>
                  {ACTIONS.map(({ key, href, icon: Icon }) => (
                    <Link
                      key={key}
                      href={`${href}?child=${child.id}`}
                      className="group flex min-h-24 flex-col justify-between gap-3 p-3 transition-colors hover:bg-[var(--surface-sunken)]"
                    >
                      <div className="flex items-start justify-between gap-2 text-[var(--brand)]">
                        <Icon className="size-4" aria-hidden="true" />
                        <ArrowUpRight className="size-3.5 text-[var(--muted)] transition-colors group-hover:text-[var(--brand)] rtl:-scale-x-100" aria-hidden="true" />
                      </div>
                      <span className="text-xs font-medium text-[var(--ink-2)]">{t(key)}</span>
                    </Link>
                  ))}
                </nav>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
