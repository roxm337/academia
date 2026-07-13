import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import {
  DocumentUpload, GuardianForm, PhotoUpload, StatusForm, StudentForm, TransferForm,
} from "@/components/director/student-forms";
import { DeleteForm } from "@/components/director/delete-form";
import { removeGuardian } from "@/lib/actions/students";
import { requireRole } from "@/lib/dal";
import { listClasses } from "@/lib/data/structure";
import { getStudent } from "@/lib/data/students";

export default async function StudentDetailPage({
  params,
}: PageProps<"/[locale]/director/students/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  await requireRole("DIRECTOR");
  const t = await getTranslations("director.students");
  const tc = await getTranslations("director.common");

  const [student, classes] = await Promise.all([getStudent(id), listClasses()]);
  if (!student) notFound();

  const classOptions = classes.map((c) => ({ id: c.id, label: c.name }));
  const active = student.enrollments.find((e) => e.isActive);

  const fullName =
    locale === "ar"
      ? `${student.user.lastNameAr} ${student.user.firstNameAr}`
      : `${student.user.lastNameFr} ${student.user.firstNameFr}`;

  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <Link
        href="/director/students"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" />
        {t("title")}
      </Link>

      <PageHeader title={fullName} subtitle={student.codeMassar} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={student.status === "ACTIVE" ? "success" : "neutral"}>
          {t(student.status)}
        </Badge>
        {active ? <Badge>{active.class.name}</Badge> : null}

        <div className="ms-auto flex flex-wrap gap-2">
          <StudentForm
            classes={classOptions}
            student={{
              id: student.id,
              codeMassar: student.codeMassar,
              cne: student.cne,
              firstNameAr: student.user.firstNameAr,
              lastNameAr: student.user.lastNameAr,
              firstNameFr: student.user.firstNameFr,
              lastNameFr: student.user.lastNameFr,
              birthDate: student.birthDate.toISOString().slice(0, 10),
              birthPlaceAr: student.birthPlaceAr,
              birthPlaceFr: student.birthPlaceFr,
              gender: student.gender,
            }}
          />
          <TransferForm
            studentId={student.id}
            classes={classOptions}
            currentClassId={active?.classId}
          />
          <StatusForm studentId={student.id} status={student.status} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* --------------------------------------------------------- identity */}
        <Card>
          <h2 className="mb-4 font-medium">{t("identity")}</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label={t("codeMassar")} value={student.codeMassar} ltr />
            <Row label={t("cne")} value={student.cne ?? tc("none")} ltr />
            <Row label={t("birthDate")} value={dateFmt.format(student.birthDate)} />
            <Row
              label={t("birthPlace")}
              value={
                (locale === "ar" ? student.birthPlaceAr : student.birthPlaceFr) ??
                tc("none")
              }
            />
            <Row
              label={t("gender")}
              value={
                student.gender === "M"
                  ? t("male")
                  : student.gender === "F"
                    ? t("female")
                    : tc("none")
              }
            />
          </dl>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <PhotoUpload studentId={student.id} />
          </div>
        </Card>

        {/* -------------------------------------------------------- guardians */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">{t("guardians")}</h2>
            <GuardianForm studentId={student.id} />
          </div>

          {student.guardians.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{tc("none")}</p>
          ) : (
            <ul className="space-y-3">
              {student.guardians.map((g) => (
                <li
                  key={g.guardianId}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {locale === "ar"
                        ? `${g.guardian.lastNameAr} ${g.guardian.firstNameAr}`
                        : `${g.guardian.lastNameFr} ${g.guardian.firstNameFr}`}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]" dir="ltr">
                      {g.guardian.phone}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge>{t(g.relation)}</Badge>
                      {g.isPrimary ? <Badge tone="success">{t("isPrimary")}</Badge> : null}
                      {g.guardian.user ? (
                        <Badge tone="warn">{g.guardian.user.email}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <DeleteForm
                    action={removeGuardian}
                    id={g.guardianId}
                    extra={{ studentId: student.id }}
                    label={t("removeGuardian")}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* -------------------------------------------------------- documents */}
        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-medium">{t("documents")}</h2>

          {student.documents.length === 0 ? (
            <p className="mb-4 text-sm text-[var(--muted)]">{tc("none")}</p>
          ) : (
            <TableWrap className="mb-4">
              <Table>
                <thead>
                  <tr>
                    <Th>{t("documentKind")}</Th>
                    <Th>{tc("new")}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {student.documents.map((d) => (
                    <tr key={d.id}>
                      <Td>{t(`docKinds.${d.kind}` as never)}</Td>
                      <Td className="text-[var(--muted)]">{d.file.filename}</Td>
                      <Td className="text-end">
                        <a
                          href={`/api/files/${d.file.path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm hover:underline"
                        >
                          <FileText className="size-4" />
                        </a>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}

          <DocumentUpload studentId={student.id} />
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="mt-0.5 font-medium" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
