import Link from "next/link";
import { href, locales, type Locale } from "@/lib/i18n/config";

const LANG_LABEL: Record<Locale, string> = { "en-pk": "English", "ur-pk": "اردو", ar: "العربية" };

// Static on purpose: no per-request auth lookup so public pages stay cacheable. "Account" redirects to sign-in when needed.
export function SiteHeader({ locale }: { locale: Locale }) {
  return (
    <header className="border-b border-line bg-paper/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href={href(locale)} className="font-display text-xl font-semibold text-brand">Ilm Academy</Link>
        <nav aria-label="Primary" className="flex items-center gap-5 text-sm">
          <ul className="hidden items-center gap-5 sm:flex">
            {locales.map((l) => (
              <li key={l}>
                <Link href={href(l)} hrefLang={l} lang={l} aria-current={l === locale ? "true" : undefined}
                  className={l === locale ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"}>{LANG_LABEL[l]}</Link>
              </li>
            ))}
          </ul>
          <Link href={href(locale, "/login")} className="btn btn-ghost">Sign in</Link>
          <Link href={href(locale, "/signup")} className="btn btn-primary">Create account</Link>
        </nav>
      </div>
    </header>
  );
}
