"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import {
  parseImportFile,
  runImport,
  type ImportResult,
  type ParseState,
} from "@/lib/actions/import";
import { IMPORT_FIELDS, validateRows, type ImportField } from "@/lib/massar";
import { Button } from "@/components/ui/button";
import {
  Badge, Card, FieldError, Label, Select, Table, TableWrap, Td, Th,
} from "@/components/ui/field";

type Option = { id: string; label: string };

export function ImportWizard({ classes }: { classes: Option[] }) {
  const t = useTranslations("director.import");
  const te = useTranslations("director.errors");
  const tr = useTranslations("director.rowErrors");
  const tc = useTranslations("common");

  const [parseState, parseAction, parsing] = useActionState<ParseState, FormData>(
    parseImportFile,
    null,
  );
  const [result, importAction, importing] = useActionState<ImportResult, FormData>(
    runImport,
    null,
  );

  // The mapping is the one thing the director edits, so it is the only client
  // state here. The sheet itself is carried through untouched.
  const [mapping, setMapping] = useState<Record<number, ImportField | "">>({});
  const [touched, setTouched] = useState(false);

  const sheet = parseState?.ok ? parseState.sheet : null;
  const effectiveMapping = touched
    ? mapping
    : (parseState?.ok ? parseState.mapping : {});

  // Validation runs in the browser for the preview; the server re-runs it for
  // real at import time. This is a convenience, never the gate.
  const rows = sheet ? validateRows(sheet, effectiveMapping) : [];
  const invalid = rows.filter((r) => r.errors.length > 0);
  const valid = rows.length - invalid.length;

  const step = result?.ok ? 4 : sheet ? 2 : 1;

  // ------------------------------------------------------------- step 4
  if (result?.ok) {
    return (
      <Card className="text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-600" />
        <h2 className="text-lg font-semibold">{t("done")}</h2>
        <p className="mt-2 text-sm">
          {t("imported", { n: result.imported ?? 0 })}
          {result.skipped ? ` · ${t("skipped", { n: result.skipped })}` : ""}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <a href="./students">
            <Button variant="outline">{t("viewStudents")}</Button>
          </a>
          <Button onClick={() => window.location.reload()}>
            {t("importAgain")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Steps current={step} />

      {/* ------------------------------------------------------------ step 1 */}
      {!sheet ? (
        <Card>
          <form action={parseAction} className="space-y-3">
            <Label htmlFor="file">{t("chooseFile")}</Label>
            <input
              id="file"
              type="file"
              name="file"
              accept=".xlsx,.csv"
              required
              className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-black/[0.06] file:px-3 file:py-2 file:text-sm"
            />
            <p className="text-xs text-[var(--muted)]">{t("fileHint")}</p>

            {parseState && !parseState.ok ? (
              <FieldError>{te(parseState.error)}</FieldError>
            ) : null}

            <Button type="submit" disabled={parsing}>
              <Upload className="size-4" />
              {parsing ? tc("loading") : t("upload")}
            </Button>
          </form>
        </Card>
      ) : (
        <>
          {/* --------------------------------------------------------- step 2 */}
          <Card className="mb-5">
            <h2 className="mb-1 font-medium">{t("step2")}</h2>
            <p className="mb-4 text-sm text-[var(--muted)]">{t("mappingHint")}</p>

            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("column")}</Th>
                    <Th>{t("sample")}</Th>
                    <Th>{t("field")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.headers.map((header, i) => (
                    <tr key={i}>
                      <Td className="font-medium">{header}</Td>
                      <Td className="text-[var(--muted)]">
                        {sheet.rows[0]?.[i] ?? ""}
                      </Td>
                      <Td>
                        <Select
                          value={effectiveMapping[i] ?? ""}
                          aria-label={header}
                          className="h-9"
                          onChange={(e) => {
                            setTouched(true);
                            setMapping({
                              ...effectiveMapping,
                              [i]: e.target.value as ImportField | "",
                            });
                          }}
                        >
                          <option value="">{t("ignore")}</option>
                          {IMPORT_FIELDS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </Select>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          {/* --------------------------------------------------------- step 3 */}
          <Card>
            <h2 className="mb-3 font-medium">{t("step3")}</h2>

            <div className="mb-4 flex flex-wrap gap-2">
              <Badge>{t("rowsTotal", { n: rows.length })}</Badge>
              <Badge tone="success">{t("rowsValid", { n: valid })}</Badge>
              {invalid.length > 0 ? (
                <Badge tone="danger">
                  {t("rowsInvalid", { n: invalid.length })}
                </Badge>
              ) : null}
            </div>

            {invalid.length > 0 ? (
              <TableWrap className="mb-4">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t("row")}</Th>
                      <Th>{t("errorsColumn")}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invalid.slice(0, 20).map((r) => (
                      <tr key={r.index}>
                        <Td className="font-mono text-xs">{r.index}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {r.errors.map((e) => (
                              <Badge key={e} tone="danger">
                                <AlertTriangle className="me-1 size-3" />
                                {tr(e as never)}
                              </Badge>
                            ))}
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : null}

            <form action={importAction} className="space-y-3">
              {/* The server re-parses and re-validates these; they are inputs,
                  not trusted results. */}
              <input type="hidden" name="sheet" value={JSON.stringify(sheet)} />
              <input
                type="hidden"
                name="mapping"
                value={JSON.stringify(effectiveMapping)}
              />

              <div className="max-w-sm">
                <Label htmlFor="classId">{t("assignToClass")}</Label>
                <Select id="classId" name="classId" defaultValue="">
                  <option value="">{t("noClassAssign")}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>

              {result?.error ? <FieldError>{te(result.error)}</FieldError> : null}

              <Button type="submit" disabled={importing || valid === 0}>
                {importing ? t("importing") : t("runImport")}
              </Button>
              {valid === 0 ? (
                <p className="text-sm text-[var(--muted)]">{t("noValidRows")}</p>
              ) : null}
            </form>
          </Card>
        </>
      )}
    </>
  );
}

function Steps({ current }: { current: number }) {
  const t = useTranslations("director.import");
  const labels = [t("step1"), t("step2"), t("step3"), t("step4")];

  return (
    <ol className="mb-5 flex flex-wrap items-center gap-2 text-sm">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = current > n;
        const active = current === n || (current === 2 && n === 3);
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={[
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                done
                  ? "bg-emerald-600 text-white"
                  : active
                    ? "bg-[var(--brand)] text-white"
                    : "bg-black/[0.07] text-[var(--muted)]",
              ].join(" ")}
            >
              {n}
            </span>
            <span className={active ? "font-medium" : "text-[var(--muted)]"}>
              {label}
            </span>
            {n < labels.length ? (
              <span className="mx-1 text-[var(--muted)]">›</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
