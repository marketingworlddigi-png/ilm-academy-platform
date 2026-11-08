import Link from "next/link";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { HeaderAuth } from "./header-auth";
import { href, locales, type Locale } from "@/lib/i18n/config";

const LANG_LABEL: Record<Locale, string> = { "en-pk": "English", "ur-pk": "اردو", ar: "العربية" };
const NAV = [["/library", "Library"], ["/courses", "Courses"], ["/pricing", "Pricing"]] as const;
// Grouped into one dropdown so the bar never overflows (see the mega-menu rule).
const EXPLORE: Array<[string, string, string]> = [
  ["/darse-nizami", "The Darse Nizami", "The eight years, stage by stage"],
  ["/subjects", "The ten subjects", "Nahw to Faraid, each explained"],
  ["/guides", "Study guides", "How to study, memorise and revise"],
  ["/how-it-works", "How it works", "For students"],
  ["/for-academies", "For academies", "Publish your courses online"],
  ["/about", "About", "Why Ilm Academy exists"],
  ["/faq", "FAQ", "Syllabus, books, plans"],
];
const linkCls = "relative whitespace-nowrap py-1 font-semibold text-ink/75 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-gold after:transition-transform hover:text-ink hover:after:scale-x-100";

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
              <Link key={p} href={href(locale, p)} className={linkCls}>{label}</Link>
            ))}
            <div className="group relative">
              <button type="button" aria-haspopup="true" className={`${linkCls} inline-flex items-center gap-1.5`}>
                Explore
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" className="transition-transform group-focus-within:rotate-180 group-hover:rotate-180"><path d="M2 3.5l3 3 3-3" /></svg>
              </button>
              <div className="invisible absolute start-1/2 top-full z-50 w-[22rem] -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 rtl:translate-x-1/2">
                <ul className="overflow-hidden rounded-[10px] border border-line bg-sheet p-2 shadow-xl">
                  {EXPLORE.map(([p, label, note]) => (
                    <li key={p}>
                      <Link href={href(locale, p)} className="block rounded-[6px] px-4 py-2.5 transition-colors hover:bg-surface">
                        <span className="block font-semibold text-ink">{label}</span>
                        <span className="block text-sm text-muted">{note}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <HeaderAuth locale={locale} accountHref={href(locale, "/learn")} loginHref={href(locale, "/login")} signupHref={href(locale, "/signup")} />
          </div>
          <MobileMenu locale={locale} accountHref={href(locale, "/learn")} loginHref={href(locale, "/login")} signupHref={href(locale, "/signup")}
            nav={[...NAV.map(([p, label]) => ({ href: href(locale, p), label })), ...EXPLORE.map(([p, label]) => ({ href: href(locale, p), label }))]}
            langs={locales.map((l) => ({ href: href(l), code: l, label: LANG_LABEL[l], current: l === locale }))} />
        </div>
      </div>
    </header>
  );
}
