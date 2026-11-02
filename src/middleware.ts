import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/lib/i18n/config";
import { refreshSession } from "@/lib/supabase/middleware";

// Paths that must not be locale-prefixed.
const BYPASS = /^\/(_next|api|auth|favicon\.ico|robots\.txt|sitemap|.*\.[a-z0-9]+$)/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (BYPASS.test(pathname)) return NextResponse.next();

  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) {
    const res = NextResponse.next();
    // Private areas must never be indexed.
    if (/^\/[^/]+\/(account|admin|login|signup|forgot-password|reset-password|checkout|academy)(\/|$)/.test(pathname)) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return refreshSession(req, res);
  }

  // Stable URL per language: always redirect to an explicit locale prefix (never IP-based).
  const url = req.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
