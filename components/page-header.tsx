/**
 * Page furniture for the register.
 *
 * The heading sits on a rule, the way a section does on a ruled page. The
 * optional eyebrow above it says which part of the school you are looking at —
 * that is information (which class, which semester), not decoration, so it is
 * only rendered when the caller has something true to put there.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  /** Context this page is scoped to, e.g. "2Bac PC — A · Semestre 1". */
  eyebrow?: string;
  /** Primary actions, on the header line rather than floating above it. */
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 border-b border-[var(--rule-strong)] pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
          <h1 className="text-2xl font-semibold text-[var(--ink)] sm:text-[1.7rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div> : null}
      </div>
    </header>
  );
}

/**
 * An empty screen is an invitation to act, not a shrug — so it takes an
 * optional action and shows the way on when the caller has one to offer.
 */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--rule-strong)] bg-[var(--surface)] px-6 py-14 text-center shadow-[0_1px_2px_rgba(23,44,70,0.03)]">
      <span className="mx-auto grid size-11 place-items-center rounded-lg bg-[var(--surface-sunken)] text-[var(--muted)]">
        <Inbox className="size-5" aria-hidden="true" />
      </span>
      <p className="mx-auto mt-4 max-w-md text-sm text-[var(--muted)]">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
import { Inbox } from "lucide-react";
