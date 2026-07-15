import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StudentGradesView } from "@/components/grades/student-grades-view";
import { requireRole, childrenOfParent } from "@/lib/dal";
import { activeClassOfStudentId } from "@/lib/data/timetable";
import { semestersOf } from "@/lib/data/grades";
import { cn } from "@/lib/utils";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/parent/grades">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("PARENT");

  const t = await getTranslations("grades");
  const sp = await searchParams;

  const [children, semesters] = await Promise.all([
    childrenOfParent(user.id),
    semestersOf(),
  ]);
  const published = semesters.filter((s) => s.gradesPublishedAt);

  if (children.length === 0 || published.length === 0) {
    return (
      <>
        <PageHeader title={t("myGrades")} />
        <EmptyState message={t("notPublishedYet")} />
      </>
    );
  }

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;

  const childId =
    (typeof sp.child === "string" && children.some((c) => c.id === sp.child) ? sp.child : null) ??
    children[0].id;
  const child = children.find((c) => c.id === childId)!;
  const semesterId = published.some((s) => s.id === sp.semester) ? String(sp.semester) : published[0].id;

  const klass = await activeClassOfStudentId(childId);
  const q = (next: { child?: string; sem?: string }) =>
    `?child=${next.child ?? childId}&semester=${next.sem ?? semesterId}`;

  return (
    <>
      <PageHeader title={t("childGrades", { name: name(child.user) })} />

      {children.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {children.map((c) => (
            <a
              key={c.id}
              href={q({ child: c.id })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                c.id === childId
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--border)] hover:bg-black/[0.03]",
              )}
            >
              {name(c.user)}
            </a>
          ))}
        </div>
      ) : null}

      {published.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {published.map((s) => (
            <a
              key={s.id}
              href={q({ sem: s.id })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                s.id === semesterId
                  ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                  : "border-[var(--border)] hover:bg-black/[0.03]",
              )}
            >
              {t("semesterN", { n: s.index })}
            </a>
          ))}
        </div>
      ) : null}

      {klass ? (
        <StudentGradesView studentId={childId} classId={klass.id} semesterId={semesterId} locale={locale} />
      ) : (
        <EmptyState message={t("noClass")} />
      )}
    </>
  );
}
