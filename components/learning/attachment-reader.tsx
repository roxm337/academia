"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen } from "lucide-react";

/**
 * The "Read" control for a PDF attachment.
 *
 * The renderer is behind `dynamic(… ssr: false)` so it is fetched the first
 * time someone actually opens a document — the lesson page itself carries none
 * of it. That is the whole reason this component exists rather than importing
 * `PdfReader` directly.
 *
 * Word documents do not come through here at all: they are converted on the
 * server and rendered inside a native <details>, which costs no JavaScript.
 */
const PdfReader = dynamic(
  () => import("@/components/learning/pdf-reader").then((m) => m.PdfReader),
  {
    ssr: false,
    loading: () => <p className="mt-3 text-sm text-[var(--muted)]">…</p>,
  },
);

export function AttachmentReader({ url, label }: { url: string; label: string }) {
  const t = useTranslations("lessons");
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--brand)] hover:underline"
      >
        <BookOpen className="size-4" aria-hidden="true" />
        {open ? t("closeReader") : t("read")}
      </button>
      {open ? <PdfReader url={url} label={label} /> : null}
    </div>
  );
}
