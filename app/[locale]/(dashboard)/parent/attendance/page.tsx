import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StudentAttendanceView } from "@/components/vie/student-attendance-view";
import { requireRole, childrenOfParent } from "@/lib/dal";
import { cn } from "@/lib/utils";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/parent/attendance">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("PARENT");

  const t = await getTranslations("vie.attendance");
  const sp = await searchParams;

  const children = await childrenOfParent(user.id);
  if (children.length === 0) {
    return (
      <>
        <PageHeader title={t("title")} />
        <EmptyState message={t("noClass")} />
      </>
    );
  }

  const name = (u: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string }) =>
    locale === "ar" ? `${u.firstNameAr} ${u.lastNameAr}` : `${u.firstNameFr} ${u.lastNameFr}`;

  const childId =
    (typeof sp.child === "string" && children.some((c) => c.id === sp.child)
      ? sp.child
      : null) ?? children[0].id;
  const child = children.find((c) => c.id === childId)!;

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

      <StudentAttendanceView
        studentId={childId}
        studentName={name(child.user)}
        locale={locale}
        canSubmit
      />
    </>
  );
}
