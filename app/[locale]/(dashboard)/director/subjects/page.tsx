import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Card, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { CoefficientRow, SubjectForm } from "@/components/director/subject-forms";
import { DeleteForm } from "@/components/director/delete-form";
import { requireRole } from "@/lib/dal";
import { deleteSubject } from "@/lib/actions/structure";
import { coefficientsFor, listLevels, listSubjects } from "@/lib/data/structure";
import { localized } from "@/lib/school";

export default async function SubjectsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/director/subjects">) {
  const { locale } = await params;
  setRequestLocale(locale);

  await requireRole("DIRECTOR");
  const t = await getTranslations("director.subjects");
  const tc = await getTranslations("director.common");

  const sp = await searchParams;
  const selected = typeof sp.level === "string" ? sp.level : "";
  const selectedStream = typeof sp.stream === "string" ? sp.stream : "";

  const [subjects, levels] = await Promise.all([listSubjects(), listLevels()]);

  const level = levels.find((l) => l.id === selected) ?? null;
  const coefficients = level
    ? await coefficientsFor(level.id, selectedStream || null)
    : [];

  const coefOf = (subjectId: string) =>
    Number(coefficients.find((c) => c.subjectId === subjectId)?.coefficient ?? 0);

  const totalCoef = coefficients.reduce((s, c) => s + Number(c.coefficient), 0);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------------------------------------- subjects */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">{t("title")}</h2>
            <SubjectForm />
          </div>

          {subjects.length === 0 ? (
            <Card className="text-center text-sm text-[var(--muted)]">
              {t("emptySubjects")}
            </Card>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("code")}</Th>
                    <Th>{tc("new")}</Th>
                    <Th className="text-end">{tc("actions")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <Td className="font-mono text-xs">{s.code}</Td>
                      <Td>{localized(s, locale)}</Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <SubjectForm
                            subject={{
                              id: s.id,
                              code: s.code,
                              nameAr: s.nameAr,
                              nameFr: s.nameFr,
                            }}
                          />
                          <DeleteForm action={deleteSubject} id={s.id} />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </section>

        {/* --------------------------------------------------- coefficients */}
        <section>
          <h2 className="mb-3 font-semibold">{t("coefficients")}</h2>

          {/* Plain GET form: the chosen level lives in the URL, so the page
              stays shareable and needs no client state. */}
          <form method="GET" className="mb-3 flex flex-wrap gap-2">
            <select
              name="level"
              defaultValue={selected}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            >
              <option value="">{t("chooseLevel")}</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {localized(l, locale)}
                </option>
              ))}
            </select>

            {level && level.streams.length > 0 ? (
              <select
                name="stream"
                defaultValue={selectedStream}
                className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
              >
                <option value="">{tc("all")}</option>
                {level.streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {localized(s, locale)}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="submit"
              className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm hover:bg-black/[0.03]"
            >
              {t("chooseLevel")}
            </button>
          </form>

          {!level ? (
            <Card className="text-center text-sm text-[var(--muted)]">
              {t("chooseLevel")}
            </Card>
          ) : (
            <Card className="p-0">
              <div className="divide-y divide-[var(--border)]">
                {subjects.map((s) => (
                  <CoefficientRow
                    key={s.id}
                    levelId={level.id}
                    streamId={selectedStream}
                    subjectId={s.id}
                    label={localized(s, locale)}
                    value={coefOf(s.id)}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2.5 text-sm">
                <span className="text-[var(--muted)]">{t("totalCoef")}</span>
                <strong>{totalCoef}</strong>
              </div>
              <p className="px-3 pb-3 text-xs text-[var(--muted)]">
                {t("notTaught")}
              </p>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
