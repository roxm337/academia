import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Badge, Card } from "@/components/ui/field";
import { AssignmentForm, TeacherForm } from "@/components/director/staff-forms";
import { DeleteForm } from "@/components/director/delete-form";
import { removeAssignment } from "@/lib/actions/staff";
import { requireRole } from "@/lib/dal";
import { currentYear, listClasses, listSubjects } from "@/lib/data/structure";
import { prisma } from "@/lib/prisma";
import { localized } from "@/lib/school";

export default async function StaffPage({
  params,
}: PageProps<"/[locale]/director/staff">) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireRole("DIRECTOR");
  const t = await getTranslations("director.staff");
  const tc = await getTranslations("director.common");

  const year = await currentYear();

  const [teachers, classes, subjects] = await Promise.all([
    prisma.teacherProfile.findMany({
      orderBy: { user: { lastNameFr: "asc" } },
      include: {
        user: true,
        subjects: { include: { subject: true } },
        assignments: {
          where: year ? { schoolYearId: year.id } : undefined,
          include: { class: true, subject: true },
          orderBy: { class: { name: "asc" } },
        },
      },
    }),
    listClasses(),
    listSubjects(),
  ]);

  const classOptions = classes.map((c) => ({ id: c.id, label: c.name }));
  const subjectOptions = subjects.map((s) => ({
    id: s.id,
    label: localized(s, locale),
  }));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-4">
        <TeacherForm subjects={subjectOptions} />
      </div>

      {teachers.length === 0 ? (
        <Card className="text-center text-sm text-[var(--muted)]">{t("empty")}</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {teachers.map((tp) => (
            <Card key={tp.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {locale === "ar"
                      ? `${tp.user.lastNameAr} ${tp.user.firstNameAr}`
                      : `${tp.user.lastNameFr} ${tp.user.firstNameFr}`}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]" dir="ltr">
                    {tp.user.email}
                    {tp.employeeNo ? ` · ${tp.employeeNo}` : ""}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {tp.subjects.length === 0 ? (
                      <span className="text-xs text-[var(--muted)]">{tc("none")}</span>
                    ) : (
                      tp.subjects.map((s) => (
                        <Badge key={s.subjectId}>
                          {localized(s.subject, locale)}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <TeacherForm
                  subjects={subjectOptions}
                  teacher={{
                    id: tp.id,
                    email: tp.user.email,
                    firstNameAr: tp.user.firstNameAr,
                    lastNameAr: tp.user.lastNameAr,
                    firstNameFr: tp.user.firstNameFr,
                    lastNameFr: tp.user.lastNameFr,
                    phone: tp.user.phone,
                    employeeNo: tp.employeeNo,
                    specialty: tp.specialty,
                    subjectIds: tp.subjects.map((s) => s.subjectId),
                  }}
                />
              </div>

              {/* -------------------------------------------- assignments */}
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium">{t("assignments")}</h3>
                  <AssignmentForm
                    teacherId={tp.id}
                    classes={classOptions}
                    subjects={subjectOptions}
                  />
                </div>

                {tp.assignments.length === 0 ? (
                  <p className="text-xs text-[var(--muted)]">{tc("none")}</p>
                ) : (
                  <ul className="space-y-1">
                    {tp.assignments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-black/[0.03]"
                      >
                        <span>
                          <strong className="font-medium">{a.class.name}</strong>
                          <span className="mx-1.5 text-[var(--muted)]">·</span>
                          {localized(a.subject, locale)}
                        </span>
                        <DeleteForm
                          action={removeAssignment}
                          id={a.id}
                          label={t("remove")}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
