import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Badge, Table, TableWrap, Td, Th } from "@/components/ui/field";
import { requireRole } from "@/lib/dal";
import { listAudit, auditEntities, AUDIT_PAGE_SIZE } from "@/lib/data/audit";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/director/audit">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("DIRECTOR");

  const t = await getTranslations("audit");
  const sp = await searchParams;
  const entity = typeof sp.entity === "string" && sp.entity ? sp.entity : null;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ rows, total }, entities] = await Promise.all([listAudit(entity, page), auditEntities()]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  const name = (a: { firstNameAr: string; lastNameAr: string; firstNameFr: string; lastNameFr: string } | null) =>
    !a ? "—" : locale === "ar" ? `${a.firstNameAr} ${a.lastNameAr}` : `${a.firstNameFr} ${a.lastNameFr}`;
  const q = (p: number) => `?${entity ? `entity=${entity}&` : ""}page=${p}`;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Entity filter — zero-JS query links */}
      <div className="mb-4 flex flex-wrap gap-2">
        <a href="?" className={`rounded-full border px-3 py-1 text-sm ${!entity ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border)]"}`}>
          {t("all")}
        </a>
        {entities.map((e) => (
          <a key={e} href={`?entity=${e}`} className={`rounded-full border px-3 py-1 text-sm ${entity === e ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border)] hover:bg-black/[0.03]"}`}>
            {e}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState message={t("none")} />
      ) : (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{t("when")}</Th>
                  <Th>{t("actor")}</Th>
                  <Th>{t("action")}</Th>
                  <Th>{t("entity")}</Th>
                  <Th>{t("details")}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap font-mono text-xs">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</Td>
                    <Td className="whitespace-nowrap">{name(r.actor)}</Td>
                    <Td><Badge tone="neutral">{r.action}</Badge></Td>
                    <Td className="text-xs">{r.entity}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}</Td>
                    <Td>
                      {r.before || r.after ? (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-[var(--muted)]">{t("view")}</summary>
                          <pre dir="ltr" className="mt-1 max-w-md overflow-x-auto rounded bg-black/[0.04] p-2">
                            {JSON.stringify({ before: r.before, after: r.after }, null, 2)}
                          </pre>
                        </details>
                      ) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          {pages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <a href={q(Math.max(1, page - 1))} className={`rounded-lg border border-[var(--border)] px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-black/[0.03]"}`}>
                {t("prev")}
              </a>
              <span className="text-[var(--muted)]">{t("pageOf", { page, pages })}</span>
              <a href={q(Math.min(pages, page + 1))} className={`rounded-lg border border-[var(--border)] px-3 py-1.5 ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-black/[0.03]"}`}>
                {t("next")}
              </a>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
