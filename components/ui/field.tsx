import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm",
        "placeholder:text-[var(--muted)]",
        "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--brand)]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium", className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--brand)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm",
        "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--brand)]",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-5",
        className,
      )}
      {...props}
    />
  );
}

/** Error text for a field or a form. Rendered as an alert for screen readers. */
export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-red-700">
      {children}
    </p>
  );
}

/**
 * Tables carry most of this app. They must scroll on their own on a phone
 * rather than making the page scroll sideways (which breaks RTL badly).
 */
export function TableWrap({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[10px] border border-[var(--line)] bg-[var(--surface)]",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        // The header is the register's column label: sunken, quiet, and closed
        // off by the one strong rule on the table.
        "whitespace-nowrap border-b border-[var(--rule-strong)] bg-[var(--surface-sunken)] px-3 py-2 text-start eyebrow",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "border-b border-[var(--line)] px-3 py-2.5 align-middle",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: "neutral" | "success" | "warn" | "danger";
}) {
  const tones = {
    neutral: "bg-[var(--surface-sunken)] text-[var(--ink-2)]",
    success: "bg-[var(--brand-soft)] text-[var(--brand)]",
    warn: "bg-amber-50 text-[var(--warn)]",
    danger: "bg-red-50 text-[var(--danger)]",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
