import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

// Next 16 renamed middleware.ts -> proxy.ts.
//
// This is an OPTIMISTIC check only: it looks for the presence of a session
// cookie and never queries the database. Real authentication and role checks
// live in lib/dal.ts, which every page and Server Action calls.

const intlMiddleware = createIntlMiddleware(routing);

// Auth.js cookie names (dev vs. https).
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

// Reachable signed-out. "/" is the marketing landing page; the page itself
// sends a signed-in visitor on to their dashboard.
const PUBLIC_PATHS = ["/", "/login"];

// Signed-in users have no reason to see these.
const SIGNED_OUT_ONLY = ["/login"];

function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  if (routing.locales.includes(segments[1] as (typeof routing.locales)[number])) {
    return "/" + segments.slice(2).join("/");
  }
  return pathname;
}

export default function proxy(request: NextRequest) {
  // Let next-intl resolve/prefix the locale first.
  const response = intlMiddleware(request);

  // If next-intl issued a redirect (missing locale prefix), let it happen.
  if (response.headers.get("location")) return response;

  const pathname = request.nextUrl.pathname;
  const locale = pathname.split("/")[1] || routing.defaultLocale;
  const path = stripLocale(pathname);

  const hasSession = SESSION_COOKIES.some((c) => request.cookies.has(c));
  const isPublic =
    path === "/" ||
    PUBLIC_PATHS.some((p) => p !== "/" && (path === p || path.startsWith(`${p}/`)));

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  if (hasSession && SIGNED_OUT_ONLY.includes(path)) {
    // Role-aware landing is decided server-side at /[locale] (see page.tsx).
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  return response;
}

export const config = {
  // Skip API routes, Next internals and anything with a file extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
