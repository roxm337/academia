"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * A PDF, rendered in the page.
 *
 * Why not an <iframe>: inline PDF viewing is inconsistent on the devices this
 * school actually uses — older Android and in-app WebViews download the file
 * instead of showing it, which is the behaviour we are replacing.
 *
 * This module is loaded on demand (see `AttachmentReader`), so a student who
 * never opens a document never downloads the renderer. One page is drawn at a
 * time rather than the whole document: a 40-page handout rendered eagerly is
 * how you run a cheap phone out of memory.
 */
export function PdfReader({ url, label }: { url: string; label: string }) {
  const t = useTranslations("lessons");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Held outside React state: it is a handle to clean up, not something the UI
  // renders, and putting it in state would re-render on every load.
  const docRef = useRef<{ numPages: number; getPage: (n: number) => Promise<unknown> } | null>(null);

  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        // Same-origin, so the session cookie rides along and /api/files applies
        // the same publication and role checks as every other download.
        const task = pdfjs.getDocument({ url, withCredentials: true });
        // destroy() belongs to the loading task, not the document — it is what
        // tears down the worker, so keeping the task is what prevents a leaked
        // worker per document opened.
        destroy = () => void task.destroy();
        const doc = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        docRef.current = doc as never;
        setPages(doc.numPages);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url]);

  // Draw whichever page is current, at whatever width the column happens to be.
  useEffect(() => {
    if (status !== "ready" || !docRef.current) return;
    let cancelled = false;

    (async () => {
      const doc = docRef.current as unknown as {
        getPage: (n: number) => Promise<{
          getViewport: (o: { scale: number }) => { width: number; height: number };
          render: (o: Record<string, unknown>) => { promise: Promise<void>; cancel: () => void };
        }>;
      };
      const p = await doc.getPage(page);
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (cancelled || !canvas || !wrap) return;

      const base = p.getViewport({ scale: 1 });
      const available = wrap.clientWidth || 600;
      // Cap the pixel ratio at 2: beyond that a full-page canvas costs memory a
      // low-end phone does not have, for detail it cannot show.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (available / base.width) * dpr;
      const viewport = p.getViewport({ scale });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = "100%";
      canvas.style.height = "auto";

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const task = p.render({ canvas, canvasContext: ctx, viewport });
      try {
        await task.promise;
      } catch {
        /* superseded by a newer page render */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, status]);

  if (status === "error") {
    return (
      <p role="alert" className="text-sm text-red-700">
        {t("readerFailed")}{" "}
        <a href={url} className="underline" target="_blank" rel="noopener">
          {t("download")}
        </a>
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="mt-3">
      {status === "loading" ? (
        <p className="text-sm text-[var(--muted)]">{t("readerLoading")}</p>
      ) : null}

      <canvas
        ref={canvasRef}
        // The drawn page carries the meaning; the filename is the accessible name.
        role="img"
        aria-label={label}
        className="w-full rounded border border-[var(--line)] bg-white"
      />

      {pages > 1 ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((n) => Math.max(1, n - 1))}
          >
            {t("prevPage")}
          </Button>
          {/* Announced on change so a screen-reader user knows the page moved. */}
          <span aria-live="polite" className="tabular text-sm text-[var(--muted)]">
            {t("pageOf", { page, pages })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((n) => Math.min(pages, n + 1))}
          >
            {t("nextPage")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
