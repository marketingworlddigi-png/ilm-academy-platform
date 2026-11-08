import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { GUIDES, guideBySlug } from "@/content/guides";
import { subjectBySlug } from "@/content/subjects";
import { PageHero } from "@/components/page-hero";
import { Article } from "@/components/article";
import { CtaBand } from "@/components/cta-band";
import { JsonLd } from "@/components/json-ld";

export const generateStaticParams = () => GUIDES.map((g) => ({ slug: g.slug }));

export async function generateMetadata({ params }: PageProps<"/[locale]/guides/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = guideBySlug(slug);
  if (!isLocale(locale) || !g) return { title: "Not found", robots: { index: false } };
  return { title: g.title, description: g.dek, alternates: alternatesFor(locale, `/guides/${g.slug}`) };
}

export default async function GuidePage({ params }: PageProps<"/[locale]/guides/[slug]">) {
  const { locale, slug } = await params;
  const g = guideBySlug(slug);
  if (!isLocale(locale) || !g) notFound();
  const related = g.related.flatMap((r) => { const s = subjectBySlug(r); return s ? [s] : []; });
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "Guides", path: href(locale, "/guides") }, { label: g.title, path: href(locale, `/guides/${g.slug}`) }]}
        eyebrow={`${g.category} · ${g.minutes} min read`} title={g.title} blurb={g.dek}
      />
      <Article intro={g.intro} sections={g.sections} />

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">Subjects mentioned</p>
            <ul className="mt-4 space-y-3">
              {related.map((s) => (
                <li key={s.slug}>
                  <Link href={href(locale, `/subjects/${s.slug}`)} className="group flex items-baseline gap-4">
                    <span lang="ar" dir="rtl" className="arabic-title min-w-24 whitespace-nowrap text-4xl text-primary-dark">{s.ar}</span>
                    <span className="font-display text-2xl underline-offset-4 group-hover:underline">{s.en}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">More guides</p>
            <ul className="mt-4 space-y-3">
              {others.map((o) => (
                <li key={o.slug}><Link href={href(locale, `/guides/${o.slug}`)} className="font-display text-2xl leading-snug underline-offset-4 hover:underline">{o.title}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <CtaBand eyebrow="Keep going" title={<>Study with <em className="gold-shimmer">the books in hand.</em></>}
        text="The library arranges books by board, darja and subject, each with its permission verified."
        primary={{ label: "Open the library", href: href(locale, "/library") }} secondary={{ label: "All guides", href: href(locale, "/guides") }} />

      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.dek, inLanguage: "en",
        url: absoluteUrl(href(locale, `/guides/${g.slug}`)),
      }} />
    </main>
  );
}
