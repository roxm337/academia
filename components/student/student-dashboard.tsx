import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Megaphone,
  UserCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge, Card } from "@/components/ui/field";

type StudentDashboardData = {
  studentName: string;
  className: string | null;
  codeMassar: string;
  schoolYear: string;
  lessonsToday: number;
  unreadAnnouncements: number;
  homeworkToSubmit: number;
  attendanceRate: number | null;
  result: { general: number | null; rank: number | null; classSize: number; mention: string | null } | null;
};

export function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const t = useTranslations("dashboard");
  const s = useTranslations("dashboard.studentPanel");
  const tc = useTranslations("common");
  // "—", "/20" and "%" are locale-visible text: Arabic uses ٪, French puts a
  // space before %. They belong in the message files like any other string.
  const na = tc("notAvailable");
  const actions = [
    { href: "/student/timetable", label: s("viewSchedule"), icon: CalendarDays },
    { href: "/student/grades", label: s("viewGrades"), icon: BookOpen },
    { href: "/student/homework", label: s("viewHomework"), icon: ClipboardCheck },
    { href: "/student/lessons", label: s("viewLessons"), icon: GraduationCap },
    { href: "/student/attendance", label: s("viewAttendance"), icon: UserCheck },
    { href: "/student/announcements", label: s("viewAnnouncements"), icon: Megaphone },
  ];

  return <div className="space-y-6">
    <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <Card className="overflow-hidden border-0 bg-[var(--brand)] p-0 text-white shadow-[0_18px_45px_rgba(15,118,110,0.18)]">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -end-12 -top-16 h-48 w-48 rounded-full border-[24px] border-white/10" />
          <p className="relative text-sm font-medium text-white/70">{s("schoolYear", { year: data.schoolYear })}</p>
          <h2 className="relative mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{t("welcome", { name: data.studentName })}</h2>
          <div className="relative mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/80">
            <span><strong className="font-semibold text-white">{s("class")}</strong> {data.className ?? s("noClass")}</span>
            <span><strong className="font-semibold text-white">{s("massar")}</strong> {data.codeMassar}</span>
          </div>
        </div>
      </Card>
      <Card className="flex flex-col justify-between p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-sm text-[var(--muted)]">{s("average")}</p><p className="mt-2 text-4xl font-semibold tracking-tight text-[var(--ink)]">{data.result?.general != null ? s("outOf20", { value: data.result.general.toFixed(2) }) : na}</p></div>
          {data.result?.mention ? <Badge tone="success">{data.result.mention}</Badge> : null}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-4 text-sm"><span className="text-[var(--muted)]">{s("rank")}</span><span className="font-semibold text-[var(--ink)]">{data.result?.rank != null ? `${data.result.rank} ${s("of")} ${data.result.classSize}` : na}</span></div>
      </Card>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label={s("lessonsToday")} value={data.lessonsToday} icon={CalendarDays} />
      <Metric label={s("homeworkToDo")} value={data.homeworkToSubmit} icon={FileText} />
      <Metric label={s("attendanceRate")} value={data.attendanceRate == null ? na : s("percent", { value: data.attendanceRate })} icon={UserCheck} />
      <Metric label={t("kpis.unreadAnnouncements")} value={data.unreadAnnouncements} icon={Megaphone} />
    </section>
    <section>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-[var(--ink)]">{s("nextActions")}</h2><ArrowUpRight className="h-5 w-5 text-[var(--muted)]" aria-hidden="true" /></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{actions.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="group rounded-xl border border-[var(--line)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[0_10px_25px_rgba(15,23,42,0.07)]"><Icon className="h-5 w-5 text-[var(--brand)]" aria-hidden="true" /><span className="mt-4 block text-sm font-semibold text-[var(--ink)]">{label}</span><ArrowUpRight className="mt-3 h-4 w-4 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" /></Link>)}</div>
    </section>
  </div>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof CalendarDays }) {
  return <Card className="flex items-center gap-4 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="min-w-0"><span className="block text-2xl font-semibold leading-none text-[var(--ink)]">{value}</span><span className="mt-1 block truncate text-xs text-[var(--muted)]">{label}</span></span></Card>;
}
