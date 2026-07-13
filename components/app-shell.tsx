"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen, Briefcase, CalendarDays, ClipboardList, FileCheck, FileText,
  LayoutDashboard, LogOut, Megaphone, MessageSquare, Menu, NotebookPen,
  School, ScrollText, Settings, ShieldAlert, UserCheck, Users, Wallet, X,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen, Briefcase, CalendarDays, ClipboardList, FileCheck, FileText,
  LayoutDashboard, Megaphone, MessageSquare, NotebookPen, School, ScrollText,
  Settings, ShieldAlert, UserCheck, Users, Wallet,
};

type Props = {
  items: NavItem[];
  schoolName: string;
  userName: string;
  roleLabel: string;
  logout: () => Promise<void>;
  children: React.ReactNode;
};

export function AppShell({
  items, schoolName, userName, roleLabel, logout, children,
}: Props) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--foreground)]",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — flows to the right automatically under dir="rtl". */}
      <aside className="hidden w-64 shrink-0 border-e border-[var(--border)] bg-[var(--surface)] p-4 md:flex md:flex-col">
        <div className="mb-6 px-2">
          <p className="truncate text-sm font-semibold">{schoolName}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
            {roleLabel}
          </p>
        </div>
        {nav}
        <form action={logout} className="mt-auto pt-4">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-black/[0.04]"
          >
            <LogOut className="size-4 rtl:-scale-x-100" />
            {tc("signOut")}
          </button>
        </form>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label={tc("cancel")}
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col bg-[var(--surface)] p-4">
            <div className="mb-6 flex items-center justify-between px-2">
              <p className="truncate text-sm font-semibold">{schoolName}</p>
              <button onClick={() => setOpen(false)} aria-label={tc("cancel")}>
                <X className="size-5" />
              </button>
            </div>
            {nav}
            <form action={logout} className="mt-auto pt-4">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)]"
              >
                <LogOut className="size-4 rtl:-scale-x-100" />
                {tc("signOut")}
              </button>
            </form>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <button
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label={tc("search")}
          >
            <Menu className="size-5" />
          </button>
          <p className="truncate text-sm font-medium">{userName}</p>
          <div className="ms-auto">
            <LocaleSwitcher />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
