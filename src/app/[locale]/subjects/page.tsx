import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { SUBJECTS } from "@/content/subjects";
import { PageHero, SectionHead } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";

export async function generateMetadata({ params }: PageProps<"/[locale]/subjects">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "The ten core Darse Nizami subjects explained",
    description: "Nahw, Sarf, Mantiq, Balaghah, Fiqh, Usul al-Fiqh, Hadith, Tafsir, Aqidah and Faraid: what each subject covers, which classical texts are commonly studied and how to approach it.",
    alternates: alternatesFor(locale, "/subjects"),
  };
}

export default async function SubjectsPage({ params }: PageProps<"/[locale]/subjects">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "Subjects", path: href(locale, "/subjects") }]}
        eyebrow="The curriculum" native="علوم" nativeLang="ar"
        title={<>Ten sciences, <em className="gold-shimmer pe-2">one course.</em></>}
        blurb="The Darse Nizami is built from ten core subjects. Each page explains what the subject studies, the classical texts commonly read, and how to approach it."
      />
      <div className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead eyebrow="Read in this order" title={<>From the language to <em className="text-primary">the sources</em></>}
          lead="The subjects are listed roughly in the order a student meets them. The early ones are tools; the later ones use those tools on the Quran and Hadith." />
        <ol className="mt-12 border-t border-line">
          {SUBJECTS.map((s, i) => (
            <li key={s.slug} className="border-b border-line">
              <Link href={href(locale, `/subjects/${s.slug}`)} className="group grid items-center gap-x-8 gap-y-3 py-9 transition-[padding] duration-300 hover:ps-4 sm:grid-cols-[4rem_minmax(0,14rem)_1fr_auto]">
                <span aria-hidden="true" className="font-display text-5xl leading-none text-vermilion">{String(i + 1).padStart(2, "0")}</span>
                <span lang="ar" dir="rtl" className="arabic-title text-start text-6xl leading-none text-primary-dark transition-colors group-hover:text-primary">{s.ar}</span>
                <span>
                  <span className="font-display block text-3xl leading-tight">{s.en}</span>
                  <span className="mt-1 block text-muted">{s.field}</span>
                  <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gold-deep">{s.stage}</span>
                </span>
                <span aria-hidden="true" className="hidden text-2xl text-gold-deep transition-transform duration-300 group-hover:translate-x-2 sm:block rtl:rotate-180">&rarr;</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <CtaBand eyebrow="Ready to begin" title={<>Open the library, <em className="gold-shimmer">pick your darja.</em></>}
        text="Every subject here has books and courses filed under its darja. Start where you are."
        primary={{ label: "Browse the library", href: href(locale, "/library") }} secondary={{ label: "Read the course roadmap", href: href(locale, "/darse-nizami") }} />
    </main>
  );
}
