import Link from "next/link";
import { href, type Locale } from "@/lib/i18n/config";

export function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="border-t border-line bg-paper-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:justify-between">
        <p>Ilm Academy Platform. Content is published only where distribution permission is recorded.</p>
        <nav aria-label="Account" className="flex gap-4">
          <Link href={href(locale, "/login")} className="hover:text-ink">Sign in</Link>
          <Link href={href(locale, "/signup")} className="hover:text-ink">Create account</Link>
        </nav>
      </div>
    </footer>
  );
}
