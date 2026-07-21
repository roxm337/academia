"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Bell, BookOpen, Briefcase, CalendarDays, ClipboardList, FileCheck, FileText,
  Gavel, GraduationCap, LayoutDashboard, LogOut, Megaphone, MessageSquare, Menu,
  NotebookPen, School, ScrollText, Settings, ShieldAlert, UserCheck, Users,
  Wallet, X,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen, Briefcase, CalendarDays, ClipboardList, FileCheck, FileText,
  Gavel, GraduationCap, LayoutDashboard, Megaphone, MessageSquare, NotebookPen, School,
  ScrollText, Settings, ShieldAlert, UserCheck, Users, Wallet,
};

type Props = {
  items: NavItem[];
  schoolName: string;
  /** From SchoolSettings, so a school that uploads its own logo gets it here. */
  logoPath: string;
  userName: string;
  roleLabel: string;
  unread: number;
  logout: () => Promise<void>;
  children: React.ReactNode;
};

export function AppShell({
  items, schoolName, logoPath, userName, roleLabel, unread, logout, children,
}: Props) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeItem = items.find(
    (item) => pathname === item.href || (item.key !== "dashboard" && pathname.startsWith(`${item.href}/`)),
  );
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const nav = (
    <nav className="flex flex-col gap-1" aria-label={tc("navigation")}>
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active =
          pathname === item.href ||
          (item.key !== "dashboard" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
              active
                ? "bg-[var(--brand)] font-medium text-white shadow-sm"
                : "text-[var(--muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--foreground)]",
            )}
          >
            <Icon className={cn("size-4 shrink-0 transition-transform", !active && "group-hover:scale-105")} />
            <span className="truncate">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-[var(--background)]">
      {/* Sidebar — flows to the right automatically under dir="rtl". */}
      <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 border-e border-[var(--border)] bg-[var(--surface)] md:flex md:flex-col">
        <div className="border-b border-[var(--line)] px-5 py-5">
          <div className="inline-flex rounded-lg bg-[var(--brand)] px-3 py-2">
            <Image
              src={logoPath}
              alt={schoolName}
              width={270}
              height={79}
              className="h-8 w-auto max-w-full object-contain object-left rtl:object-right"
              priority
            />
          </div>
          <p className="mt-3 truncate text-xs font-semibold text-[var(--muted)]">{roleLabel}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{nav}</div>
        <div className="border-t border-[var(--line)] p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand)]">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--ink)]">{userName}</p>
              <p className="truncate text-xs text-[var(--muted)]">{roleLabel}</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
            >
              <LogOut className="size-4 rtl:-scale-x-100" />
              {tc("signOut")}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label={tc("closeNavigation")}
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 flex w-[min(19rem,88vw)] flex-col bg-[var(--surface)] shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--line)] p-4">
              <div className="inline-flex min-w-0 rounded-lg bg-[var(--brand)] px-3 py-2">
                <Image
                  src={logoPath}
                  alt={schoolName}
                  width={270}
                  height={79}
                  className="h-8 w-auto min-w-0 object-contain object-left rtl:object-right"
                  priority
                />
              </div>
              <button className="grid size-10 place-items-center rounded-lg hover:bg-[var(--surface-sunken)]" onClick={() => setOpen(false)} aria-label={tc("closeNavigation")}>
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4">{nav}</div>
            <form action={logout} className="mt-auto border-t border-[var(--line)] p-4">
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
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur md:px-6">
          <button
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--surface-sunken)] md:hidden"
            onClick={() => setOpen(true)}
            aria-label={tc("openNavigation")}
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">{activeItem ? t(activeItem.key) : roleLabel}</p>
            <p className="hidden truncate text-xs text-[var(--muted)] sm:block md:hidden">{userName}</p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <Link
              href="/notifications"
              aria-label={t("notifications")}
              className="relative grid size-10 place-items-center rounded-lg text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
            >
              <Bell className="size-5" />
              {unread > 0 ? (
                <span className="absolute -top-0.5 -end-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <LocaleSwitcher />
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-[100rem] flex-1 p-4 sm:p-5 md:p-7 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
