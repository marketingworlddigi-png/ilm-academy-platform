import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { FAQ_GROUPS } from "@/content/site-pages";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { JsonLd } from "@/components/json-ld";

export async function generateMetadata({ params }: PageProps<"/[locale]/faq">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "Frequently asked questions",
    description: "Answers about the Darse Nizami syllabus, books and permissions, courses, plans and payments, and teaching on Ilm Academy.",
    alternates: alternatesFor(locale, "/faq"),
  };
}

export default async function FaqPage({ params }: PageProps<"/[locale]/faq">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "FAQ", path: href(locale, "/faq") }]}
        eyebrow="Help" native="سوالات"
        title={<>Questions, <em className="gold-shimmer pe-2">answered.</em></>}
        blurb="Plain answers about the syllabus, the books, the courses, plans and payments, and teaching here."
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Topics" className="lg:sticky lg:top-28 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">Topics</p>
          <ul className="mt-4 space-y-1 border-s border-line text-sm">
            {FAQ_GROUPS.map((g) => (
              <li key={g.id}><a href={`#${g.id}`} className="-ms-px block border-s border-transparent py-1.5 ps-4 text-muted transition-colors hover:border-gold-deep hover:text-ink">{g.title}</a></li>
            ))}
          </ul>
        </nav>
        <div className="space-y-16">
          {FAQ_GROUPS.map((g) => (
            <section key={g.id} id={g.id} className="scroll-mt-28">
              <h2 className="text-4xl">{g.title}</h2>
              <div className="ornament mt-5 max-w-xs"><span /></div>
              <div className="mt-6 divide-y divide-line border-y border-line">
                {g.items.map((f) => (
                  <details key={f.q} className="group py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                      {f.q}<span aria-hidden="true" className="relative h-4 w-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-gold-deep after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-gold-deep after:transition-transform group-open:after:scale-y-0" />
                    </summary>
                    <p className="mt-3 max-w-2xl leading-relaxed text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
          <p className="text-muted">Looking for how a permission is checked? Read the <Link className="font-semibold text-primary underline" href={href(locale, "/copyright")}>copyright and permissions</Link> page.</p>
        </div>
      </div>
      <CtaBand eyebrow="Still unsure" title={<>See it <em className="gold-shimmer">for yourself.</em></>} text="The library and course pages can be browsed without an account."
        primary={{ label: "Browse the library", href: href(locale, "/library") }} secondary={{ label: "How it works", href: href(locale, "/how-it-works") }} />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: FAQ_GROUPS.flatMap((g) => g.items).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }} />
    </main>
  );
}
