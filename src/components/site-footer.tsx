import Link from "next/link";
import { Logo } from "./logo";
import { href, type Locale } from "@/lib/i18n/config";

const COLUMNS: Array<{ title: string; links: Array<[string, string]> }> = [
  { title: "Learn", links: [["/library", "Library"], ["/courses", "Courses"], ["/pricing", "Pricing"]] },
  { title: "Teach", links: [["/academy/register", "Register your academy"]] },
  { title: "Help", links: [["/login", "Sign in"], ["/signup", "Create account"]] },
];

export function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="khatam relative overflow-hidden text-white">
      {/* The Urdu name as a large watermark: purely decorative, hidden from assistive technology. */}
      <span aria-hidden="true" lang="ur" dir="rtl" className="urdu pointer-events-none absolute -bottom-10 end-4 select-none text-[9rem] font-bold leading-none text-white/[0.05] sm:text-[14rem]">علم</span>
      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">The Darse Nizami syllabus, taught year by year. Books are published only where distribution permission is recorded.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold">{c.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([p, label]) => (
                <li key={p}><Link href={href(locale, p)} className="text-white/80 transition-colors hover:text-gold">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
