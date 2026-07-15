import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StudentHomeworkList } from "@/components/pedagogy/student-homework-list";
import { requireRole, childrenOfParent } from "@/lib/dal";
import { activeClassOfStudentId } from "@/lib/data/timetable";
import { cn } from "@/lib/utils";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/parent/homework">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("PARENT");

  const t = await getTranslations("homework");
  const sp = await searchParams;
  const children = await childrenOfParent(user.id);

  if (children.length === 0) {
    return (
      <>
        <PageHeader title={t("myTitle")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;

  const childId =
    (typeof sp.child === "string" && children.some((c) => c.id === sp.child) ? sp.child : null) ??
    children[0].id;
  const child = children.find((c) => c.id === childId)!;
  const klass = await activeClassOfStudentId(childId);

  return (
    <>
      <PageHeader title={t("childTitle", { name: name(child.user) })} />

      {children.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {children.map((c) => (
            <a
              key={c.id}
              href={`?child=${c.id}`}
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

      {klass ? (
        <StudentHomeworkList classId={klass.id} studentId={childId} locale={locale} canSubmit={false} />
      ) : (
        <EmptyState message={t("noClass")} />
      )}
    </>
  );
}
