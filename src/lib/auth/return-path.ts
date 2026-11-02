import { href, type Locale } from "@/lib/i18n/config";
import { safeNextPath } from "./safe-next";

/** Sign-in link that returns the visitor to `next` afterwards. */
export const loginUrl = (locale: Locale, next?: string): string =>
  next ? `${href(locale, "/login")}?next=${encodeURIComponent(next)}` : href(locale, "/login");

/** Where to send someone who has just signed in. Anything that is not a same-site path falls back to the account page. */
export const postLoginPath = (locale: Locale, next: unknown): string =>
  safeNextPath(typeof next === "string" ? next : null, href(locale, "/account"));
