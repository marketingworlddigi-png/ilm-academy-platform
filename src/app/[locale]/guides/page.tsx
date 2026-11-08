import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { GUIDES } from "@/content/guides";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";

export async function generateMetadata({ params }: PageProps<"/[locale]/guides">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "Study guides for students of the classical sciences",
    description: "Practical guides on reading a kitab, learning nahw and sarf, memorising texts, planning a part-time week and choosing an online course.",
    alternates: alternatesFor(locale, "/guides"),
  };
}

export default async function GuidesPage({ params }: PageProps<"/[locale]/guides">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [lead, ...rest] = GUIDES;
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "Guides", path: href(locale, "/guides") }]}
        eyebrow="Study guides" native="رہنمائی"
        title={<>How to study, <em className="gold-shimmer pe-2">properly.</em></>}
        blurb="Practical guidance for students of the classical sciences: how a kitab is built, how to memorise, how to plan a week, and how to judge a course."
      />
      <div className="mx-auto max-w-6xl px-5 py-16">
        <Link href={href(locale, `/guides/${lead.slug}`)} className="khatam group relative grid gap-6 overflow-hidden rounded-[10px] border border-primary-dark p-8 text-white md:grid-cols-[1.4fr_1fr] md:p-12">
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Start here &middot; {lead.category} &middot; {lead.minutes} min read</p>
            <h2 className="mt-4 text-4xl leading-tight sm:text-5xl">{lead.title}</h2>
            <p className="mt-4 max-w-xl text-lg text-white/75">{lead.dek}</p>
            <span className="mt-8 inline-flex items-center gap-2 font-semibold text-gold">Read the guide <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5 rtl:rotate-180">&rarr;</span></span>
          </div>
          <div aria-hidden="true" className="relative hidden items-center justify-center md:flex">
            <span lang="ar" dir="rtl" className="arabic-title text-[8rem] leading-none text-gold/90">متن</span>
          </div>
        </Link>

        <ul className="mt-14 divide-y divide-line border-y border-line">
          {rest.map((g, i) => (
            <li key={g.slug}>
              <Link href={href(locale, `/guides/${g.slug}`)} className="group grid gap-x-8 gap-y-2 py-8 transition-[padding] duration-300 hover:ps-3 md:grid-cols-[4rem_1fr_auto] md:items-center">
                <span aria-hidden="true" className="font-display text-5xl leading-none text-vermilion">{String(i + 2).padStart(2, "0")}</span>
                <span>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-deep">{g.category} &middot; {g.minutes} min read</span>
                  <span className="font-display mt-1 block text-3xl leading-tight">{g.title}</span>
                  <span className="mt-2 block max-w-2xl text-muted">{g.dek}</span>
                </span>
                <span aria-hidden="true" className="hidden text-2xl text-gold-deep transition-transform duration-300 group-hover:translate-x-2 md:block rtl:rotate-180">&rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <CtaBand eyebrow="Put it into practice" title={<>Pick a subject <em className="gold-shimmer">and begin.</em></>}
        text="Each subject has its own page: what it covers, the texts commonly studied, and how to approach it."
        primary={{ label: "Explore the subjects", href: href(locale, "/subjects") }} secondary={{ label: "Open the library", href: href(locale, "/library") }} />
    </main>
  );
}
