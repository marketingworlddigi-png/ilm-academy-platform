import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale } from "@/lib/i18n/config";

// Paths that must not be locale-prefixed.
const BYPASS = /^\/(_next|api|favicon\.ico|robots\.txt|sitemap|.*\.[a-z0-9]+$)/i;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (BYPASS.test(pathname)) return NextResponse.next();

  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) return NextResponse.next();

  // Stable URL per language: always redirect to an explicit locale prefix (never IP-based).
  const url = req.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url, 308);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
