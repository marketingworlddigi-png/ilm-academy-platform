import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dirOf, htmlLangOf, isLocale, locales } from "@/lib/i18n/config";
import "../globals.css";

export const generateStaticParams = () => locales.map((locale) => ({ locale }));

export const metadata: Metadata = {
  title: { default: "Ilm Academy Platform", template: "%s | Ilm Academy Platform" },
  description: "Multi-academy education marketplace and LMS.",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={htmlLangOf(locale)} dir={dirOf(locale)}>
      <body className="min-h-screen bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
