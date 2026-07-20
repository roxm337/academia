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
    <header className="mb-6 border-b border-[var(--rule-strong)] pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
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
    <div className="rounded-[10px] border border-dashed border-[var(--rule-strong)] bg-[var(--surface)] px-6 py-12 text-center">
      <p className="text-sm text-[var(--muted)]">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
