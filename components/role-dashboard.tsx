import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  School,
  ShieldAlert,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { KpiGrid } from "@/components/kpi";
import type { Kpi } from "@/lib/data/dashboard";

type Role = "director" | "teacher" | "surveillant" | "parent";

const ACTIONS: Record<Role, { href: string; key: string; icon: typeof CalendarDays }[]> = {
  director: [
    { href: "/director/students", key: "students", icon: Users },
    { href: "/director/classes", key: "classes", icon: School },
    { href: "/director/timetable", key: "timetable", icon: CalendarDays },
    { href: "/director/grades", key: "grades", icon: ClipboardList },
    { href: "/director/reports", key: "reports", icon: FileText },
  ],
  teacher: [
    { href: "/teacher/timetable", key: "timetable", icon: CalendarDays },
    { href: "/teacher/grades", key: "grades", icon: ClipboardList },
    { href: "/teacher/homework", key: "homework", icon: BookOpen },
    { href: "/teacher/lessons", key: "lessons", icon: GraduationCap },
    { href: "/teacher/cahier", key: "cahier", icon: FileText },
    { href: "/teacher/attendance", key: "attendance", icon: UserCheck },
  ],
  surveillant: [
    { href: "/surveillant/attendance", key: "attendance", icon: UserCheck },
    { href: "/surveillant/justifications", key: "justifications", icon: FileCheck },
    { href: "/surveillant/discipline", key: "discipline", icon: ShieldAlert },
    { href: "/surveillant/announcements", key: "announcements", icon: Megaphone },
  ],
  parent: [
    { href: "/parent/children", key: "children", icon: Users },
    { href: "/parent/timetable", key: "timetable", icon: CalendarDays },
    { href: "/parent/grades", key: "grades", icon: ClipboardList },
    { href: "/parent/homework", key: "homework", icon: BookOpen },
    { href: "/parent/fees", key: "fees", icon: Wallet },
  ],
};

export function RoleDashboard({ role, kpis }: { role: Role; kpis: Kpi[] }) {
  const t = useTranslations("dashboard");
  const actions = ACTIONS[role];

  return (
    <div className="space-y-6">
      <KpiGrid items={kpis} />
      <section>
        <div className="flex items-start gap-3 border-b border-[var(--line)] pb-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
            <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[var(--ink)]">{t(`rolePanels.${role}.title`)}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t(`rolePanels.${role}.subtitle`)}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {actions.map(({ href, key, icon: Icon }) => (
            <Link key={href} href={href} className="group min-h-32 rounded-lg border border-[var(--line)] bg-white p-4 shadow-[0_1px_2px_rgba(23,44,70,0.035)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <span className="grid size-9 place-items-center rounded-lg bg-[var(--surface-sunken)] text-[var(--brand)] transition-colors group-hover:bg-[var(--brand-soft)]">
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="mt-3 block text-sm font-semibold text-[var(--ink)]">{t(`quickActions.${key}`)}</span>
              <span className="mt-3 block text-xs text-[var(--muted)] transition group-hover:text-[var(--brand)]">{t("openSection")}</span>
            </Link>
          ))}
        </div>
      </section>
      <div className="flex items-center gap-2 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)]">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t(`rolePanels.${role}.footnote`)}</span>
      </div>
    </div>
  );
}
