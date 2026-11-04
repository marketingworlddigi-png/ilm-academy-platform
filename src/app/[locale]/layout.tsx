import type { Metadata } from "next";
import { Amiri, Noto_Nastaliq_Urdu, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { dirOf, htmlLangOf, isLocale, locales } from "@/lib/i18n/config";
import { robotsForLocale } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const urdu = Noto_Nastaliq_Urdu({ subsets: ["arabic"], variable: "--font-urdu", display: "swap", preload: false });
const amiri = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--font-amiri", display: "swap", preload: false });

export const generateStaticParams = () => locales.map((locale) => ({ locale }));

// metadataBase makes every relative URL in page metadata (canonicals, Open Graph images) resolve to the real domain.
// Robots is per language: pages not yet translated are noindex,follow. Pages may override (e.g. not-found).
export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: "Ilm Academy Platform", template: "%s | Ilm Academy Platform" },
    description: "Multi-academy education marketplace and LMS.",
    ...(isLocale(locale) ? { robots: robotsForLocale(locale) } : {}),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={htmlLangOf(locale)} dir={dirOf(locale)} className={`${jakarta.variable} ${urdu.variable} ${amiri.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader locale={locale} />
        <div className="flex-1">{children}</div>
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
