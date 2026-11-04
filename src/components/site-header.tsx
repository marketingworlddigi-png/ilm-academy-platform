import Link from "next/link";
import { HeaderAuth } from "./header-auth";
import { href, locales, type Locale } from "@/lib/i18n/config";

const LANG_LABEL: Record<Locale, string> = { "en-pk": "English", "ur-pk": "اردو", ar: "العربية" };
const NAV = [["/library", "Library"], ["/courses", "Courses"], ["/pricing", "Pricing"]] as const;

// Static on purpose: no per-request auth lookup so public pages stay cacheable. "My learning" redirects to sign-in when needed.
export function SiteHeader({ locale }: { locale: Locale }) {
  return (
    <header>
      <div className="bg-primary-dark text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2 text-xs">
          <p className="hidden text-white/80 sm:block">Kanz-ul-Madaris and Tanzeem-ul-Madaris syllabus, organised year by year</p>
          <ul className="ms-auto flex items-center gap-4">
            {locales.map((l) => (
              <li key={l}>
                <Link href={href(l)} hrefLang={l} lang={l} aria-current={l === locale ? "true" : undefined}
                  className={l === locale ? "font-bold text-gold" : "text-white/80 hover:text-white"}>{LANG_LABEL[l]}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3">
          <Link href={href(locale)} className="flex items-center gap-2 text-lg font-bold text-primary-dark">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary-dark text-gold">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z" /></svg>
            </span>
            Ilm Academy
          </Link>
          <nav aria-label="Primary" className="order-3 flex w-full items-center gap-5 overflow-x-auto text-sm sm:order-none sm:w-auto">
            {NAV.map(([p, label]) => (
              <Link key={p} href={href(locale, p)} className="whitespace-nowrap font-medium text-muted hover:text-ink">{label}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <HeaderAuth locale={locale} accountHref={href(locale, "/learn")} loginHref={href(locale, "/login")} signupHref={href(locale, "/signup")} />
          </div>
        </div>
      </div>
    </header>
  );
}
