"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * A dialog that opens from a trigger button. Uses the native <dialog> so focus
 * trapping, Esc and the backdrop come from the platform rather than from us.
 */
export function Modal({
  trigger,
  title,
  children,
  open: controlledOpen,
  onClose,
}: {
  trigger?: React.ReactNode;
  title: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  open?: boolean;
  onClose?: () => void;
}) {
  const t = useTranslations("director.common");
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const isOpen = controlledOpen ?? open;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  const close = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="contents">
          {trigger}
        </span>
      ) : null}

      <dialog
        ref={ref}
        onClose={close}
        onClick={(e) => {
          // click on the backdrop (the dialog element itself) closes it
          if (e.target === ref.current) close();
        }}
        className="w-[min(38rem,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="rounded-md p-1 hover:bg-black/[0.05]"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {typeof children === "function" ? children(close) : children}
        </div>
      </dialog>
    </>
  );
}

/**
 * Closes its dialog once the action reports success. This has to be an effect —
 * calling close() during render would be a side effect in the render phase.
 */
export function CloseOnSuccess({
  ok,
  close,
}: {
  ok?: boolean;
  close: () => void;
}) {
  useEffect(() => {
    if (ok) close();
    // `close` is recreated each render; the success flag is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok]);
  return null;
}

/** A submit button that asks first. For deletes and other one-way doors. */
export function ConfirmButton({
  message,
  children,
  className,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
