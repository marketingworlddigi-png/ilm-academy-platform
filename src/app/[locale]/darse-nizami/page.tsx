import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { STAGES, FAQ_GROUPS } from "@/content/site-pages";
import { subjectBySlug } from "@/content/subjects";
import { PageHero, SectionHead } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { JsonLd } from "@/components/json-ld";

export async function generateMetadata({ params }: PageProps<"/[locale]/darse-nizami">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "The Darse Nizami: the eight-year course, year by year",
    description: "What the Darse Nizami is, where it comes from, how the eight years are arranged and what a student can do at the end of each stage.",
    alternates: alternatesFor(locale, "/darse-nizami"),
  };
}

const ORIGINS: Array<[string, string]> = [
  ["The name", "The course takes its name from Mulla Nizam al-Din (d. 1748) of Lucknow, who arranged a graded curriculum at the Farangi Mahal. The word darse means a lesson or course; nizami refers to him."],
  ["The idea", "The curriculum puts the tools first. Language, logic and method are taught early so that the student can later read the sources of law, hadith and tafsir directly, in Arabic, with the classical commentaries."],
  ["The reach", "It is taught in madrasas across Pakistan, India, Bangladesh and the diaspora. Boards differ in their exact books, but the shape of the course is shared."],
];

export default async function DarseNizamiPage({ params }: PageProps<"/[locale]/darse-nizami">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const faq = FAQ_GROUPS.find((g) => g.id === "syllabus")!.items;
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "Darse Nizami", path: href(locale, "/darse-nizami") }]}
        eyebrow="The course" native="درسِ نظامی"
        title={<>Eight years, <em className="gold-shimmer pe-2">four stages.</em></>}
        blurb="An overview of the classical madrasa course: where it comes from, how it is arranged, and what you can do at the end of each stage."
      />

      <div className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead eyebrow="Origins" title={<>A course built <em className="text-primary">tools first</em></>} />
        <dl className="mt-12 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line md:grid-cols-3">
          {ORIGINS.map(([t, d]) => (
            <div key={t} className="bg-sheet p-7">
              <dt className="font-display text-3xl">{t}</dt>
              <dd className="mt-3 leading-relaxed text-ink/80">{d}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="khatam relative text-white">
        <div className="relative mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">The roadmap</p>
          <h2 className="mt-3 max-w-3xl text-4xl sm:text-6xl">From the alphabet of grammar to <em className="gold-shimmer">the great collections</em></h2>
          <p className="mt-5 max-w-2xl text-lg text-white/75">The stages below describe the usual shape of the eight years. Individual boards move books between years, so read this as a map, not a timetable.</p>
          <ol className="mt-14 space-y-0">
            {STAGES.map((st) => (
              <li key={st.n} className="grid gap-x-10 gap-y-4 border-t border-white/15 py-10 md:grid-cols-[9rem_1fr_1fr]">
                <div>
                  <span aria-hidden="true" className="gold-shimmer font-display text-7xl leading-none">{st.n}</span>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">{st.years}</p>
                </div>
                <div>
                  <p lang="ur" dir="rtl" className="urdu w-fit text-2xl font-bold text-gold">{st.ur}</p>
                  <h3 className="font-display text-3xl sm:text-4xl">{st.title}</h3>
                  <p className="mt-3 leading-relaxed text-white/75">{st.summary}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {st.subjects.map((sl) => { const sub = subjectBySlug(sl)!; return (
                      <li key={sl}><Link href={href(locale, `/subjects/${sl}`)} className="inline-flex items-baseline gap-2 rounded-full border border-gold/40 px-3.5 py-1 text-sm transition-colors hover:border-gold hover:bg-gold/10">
                        <span lang="ar" dir="rtl" className="arabic-title text-lg text-gold">{sub.ar}</span>{sub.en}</Link></li>
                    ); })}
                  </ul>
                </div>
                <div className="md:border-s md:border-white/15 md:ps-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">In this stage</p>
                  <ul className="mt-3 space-y-2 text-white/80">
                    {st.focus.map((f) => <li key={f} className="flex gap-3"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" />{f}</li>)}
                  </ul>
                  <p className="font-display mt-6 text-xl leading-snug text-gold">{st.milestone}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHead eyebrow="Your darja" title={<>How this site <em className="text-primary">maps to it</em></>} />
            <div className="prose-ilm mt-6">
              <p>The library arranges the course by board, then by darja, then by subject. For a board such as Kanz-ul-Madaris the years are numbered from Darja Oola to Darja Sabia (Mauqoof Alaih), with the equivalents in school terms shown beside each.</p>
              <p>Each darja page lists its subjects. Each subject page lists the books and notes filed under it, and each book shows whether it is free, academy-only or Premium. A darja with no content yet is marked rather than hidden, so you can see the whole course and what is still to come.</p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={href(locale, "/library")} className="inline-flex items-center rounded-[6px] bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-dark">Open the library</Link>
              <Link href={href(locale, "/subjects")} className="inline-flex items-center rounded-[6px] border border-line bg-sheet px-6 py-3 font-semibold transition-colors hover:border-primary hover:text-primary">The ten subjects</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">Common questions</p>
            <div className="mt-4 divide-y divide-line border-y border-line">
              {faq.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}<span aria-hidden="true" className="relative h-4 w-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-gold-deep after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-gold-deep after:transition-transform group-open:after:scale-y-0" />
                  </summary>
                  <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CtaBand eyebrow="Begin" title={<>Know where you are <em className="gold-shimmer">in the course.</em></>}
        text="Find your darja, see its subjects and open the books filed under each."
        primary={{ label: "Browse the library", href: href(locale, "/library") }} secondary={{ label: "Study guides", href: href(locale, "/guides") }} />

      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Course", name: "Darse Nizami", description: "The eight-year classical madrasa course of Islamic sciences.",
        url: absoluteUrl(href(locale, "/darse-nizami")), provider: { "@type": "Organization", name: "Ilm Academy" },
      }} />
    </main>
  );
}
