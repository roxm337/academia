import { getTranslations, setRequestLocale } from "next-intl/server";
import { Printer } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { ReadOnlyTimetable } from "@/components/readonly-timetable";
import { requireRole, childrenOfParent } from "@/lib/dal";
import { activeClassOfStudentId, getClassSlots } from "@/lib/data/timetable";
import { cn } from "@/lib/utils";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/parent/timetable">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const user = await requireRole("PARENT");

  const t = await getTranslations("timetable");

  // Only ever this parent's own children — never a studentId from the URL.
  const children = await childrenOfParent(user.id);
  if (children.length === 0) {
    return (
      <>
        <PageHeader title={t("myTimetable")} />
        <EmptyState message={t("noChildren")} />
      </>
    );
  }

  const name = (u: {
    firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string;
  }) =>
    locale === "ar"
      ? `${u.firstNameAr} ${u.lastNameAr}`
      : `${u.firstNameFr} ${u.lastNameFr}`;

  const childId =
    (typeof sp.child === "string" && children.some((c) => c.id === sp.child)
      ? sp.child
      : null) ?? children[0].id;
  const child = children.find((c) => c.id === childId)!;


  const klass = await activeClassOfStudentId(childId);
  const slots = klass ? await getClassSlots(klass.id) : [];

  const q = (next: { child?: string }) => `?child=${next.child ?? childId}`;

  return (
    <>
      <PageHeader
        title={t("childTimetable", { name: name(child.user) })}
        subtitle={klass ? t("forClass", { name: klass.name }) : undefined}
      />

      {/* Child chooser — zero-JS query anchors, one per child. */}
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

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {klass ? (
          <a
            href={`/api/timetable/pdf?class=${klass.id}&locale=${locale}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-black/[0.03]"
          >
            <Printer className="size-4" />
            {t("print")}
          </a>
        ) : null}
      </div>

      {klass ? (
        <ReadOnlyTimetable
          slots={slots}
          locale={locale}
          mode="student"
        />
      ) : (
        <EmptyState message={t("studentNoClass")} />
      )}
    </>
  );
}
