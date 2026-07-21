import { getTranslations, setRequestLocale } from "next-intl/server";
import { FileSpreadsheet, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Badge, Input, Select, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { StudentForm } from "@/components/director/student-forms";
import { requireRole } from "@/lib/dal";
import { listClasses } from "@/lib/data/structure";
import { searchStudents } from "@/lib/data/students";
import type { StudentStatus } from "@/lib/generated/prisma/enums";

const STATUSES = ["ACTIVE", "ARCHIVED", "TRANSFERRED", "GRADUATED"] as const;

export default async function StudentsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/director/students">) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireRole("DIRECTOR");
  const t = await getTranslations("director.students");
  const tc = await getTranslations("director.common");
  const common = await getTranslations("common");

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const classId = typeof sp.class === "string" ? sp.class : "";
  const status = (typeof sp.status === "string" ? sp.status : "") as StudentStatus | "";

  const [classes, result] = await Promise.all([
    listClasses(),
    searchStudents({ q, classId, status }),
  ]);
  const { students, total, truncated } = result;

  const classOptions = classes.map((c) => ({ id: c.id, label: c.name }));

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link href="/director/students/import">
              <Button variant="outline" size="md">
                <FileSpreadsheet className="size-4" />
                {t("import")}
              </Button>
            </Link>
            <StudentForm classes={classOptions} />
          </>
        }
      />

      <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_1px_2px_rgba(23,44,70,0.035)] sm:p-4">
        {/* GET form: filters live in the URL, so a filtered list is shareable. */}
        <form method="GET" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_auto_auto_auto]">
          <Input
            name="q"
            defaultValue={q}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-10"
          />
          <Select
            name="class"
            defaultValue={classId}
            aria-label={t("class")}
            className="h-10"
          >
            <option value="">{tc("all")}</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            name="status"
            defaultValue={status}
            aria-label={t("status")}
            className="h-10"
          >
            <option value="">{tc("all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" size="sm" className="h-10">
            <Search className="size-4" />
            {common("search")}
          </Button>
        </form>

        <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
          <p className="text-xs font-medium text-[var(--muted)]">{common("results", { count: total })}</p>

          {/* The list is capped, so disclose when only part of it is visible. */}
          {truncated ? (
            <p className="text-xs text-amber-700">
              {t("truncated", { shown: students.length, total })}
            </p>
          ) : null}
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState message={t("empty")} />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>{t("codeMassar")}</Th>
                <Th>{t("name")}</Th>
                <Th>{t("class")}</Th>
                <Th>{t("status")}</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const klass = s.enrollments[0]?.class ?? null;
                return (
                  <tr key={s.id} className="hover:bg-black/[0.02]">
                    <Td className="font-mono text-xs" dir="ltr">
                      <Link
                        href={`/director/students/${s.id}`}
                        className="hover:underline"
                      >
                        {s.codeMassar}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/director/students/${s.id}`}
                        className="font-medium hover:underline"
                      >
                        {locale === "ar"
                          ? `${s.user.lastNameAr} ${s.user.firstNameAr}`
                          : `${s.user.lastNameFr} ${s.user.firstNameFr}`}
                      </Link>
                    </Td>
                    <Td>
                      {klass ? (
                        klass.name
                      ) : (
                        <span className="text-[var(--muted)]">{t("noClass")}</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>
                        {t(s.status)}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
