import Link from "next/link";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { HeaderAuth } from "./header-auth";
import { href, locales, type Locale } from "@/lib/i18n/config";

const LANG_LABEL: Record<Locale, string> = { "en-pk": "English", "ur-pk": "اردو", ar: "العربية" };
const NAV = [["/library", "Library"], ["/courses", "Courses"], ["/pricing", "Pricing"]] as const;

// Static on purpose: no per-request auth lookup so public pages stay cacheable. "My learning" redirects to sign-in when needed.
export function SiteHeader({ locale }: { locale: Locale }) {
  return (
    <header className="sticky top-0 z-40">
      <div className="hidden bg-primary-dark text-white md:block">
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
      <div className="border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-x-6 px-5 py-3">
          <Link href={href(locale)} aria-label="Ilm Academy home"><Logo /></Link>
          <nav aria-label="Primary" className="hidden items-center gap-7 text-[0.95rem] md:flex">
            {NAV.map(([p, label]) => (
              <Link key={p} href={href(locale, p)} className="relative whitespace-nowrap py-1 font-semibold text-ink/75 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-gold after:transition-transform hover:text-ink hover:after:scale-x-100">{label}</Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <HeaderAuth locale={locale} accountHref={href(locale, "/learn")} loginHref={href(locale, "/login")} signupHref={href(locale, "/signup")} />
          </div>
          <MobileMenu locale={locale} accountHref={href(locale, "/learn")} loginHref={href(locale, "/login")} signupHref={href(locale, "/signup")}
            nav={NAV.map(([p, label]) => ({ href: href(locale, p), label }))}
            langs={locales.map((l) => ({ href: href(l), code: l, label: LANG_LABEL[l], current: l === locale }))} />
        </div>
      </div>
    </header>
  );
}
