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
    <footer className="bg-primary-dark text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-2 max-w-xs text-sm text-white/70">Books are published only where distribution permission is recorded.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-xs font-bold uppercase tracking-widest text-gold">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map(([p, label]) => (
                <li key={p}><Link href={href(locale, p)} className="text-white/80 hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
