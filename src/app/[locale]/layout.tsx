import type { Metadata } from "next";
import { Inter, Newsreader, Noto_Naskh_Arabic } from "next/font/google";
import { notFound } from "next/navigation";
import { dirOf, htmlLangOf, isLocale, locales } from "@/lib/i18n/config";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
const arabic = Noto_Naskh_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap" });

export const generateStaticParams = () => locales.map((locale) => ({ locale }));

export const metadata: Metadata = {
  title: { default: "Ilm Academy Platform", template: "%s | Ilm Academy Platform" },
  description: "Multi-academy education marketplace and LMS.",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={htmlLangOf(locale)} dir={dirOf(locale)} className={`${inter.variable} ${newsreader.variable} ${arabic.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader locale={locale} />
        <div className="flex-1">{children}</div>
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
