import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { SUBJECTS, subjectBySlug } from "@/content/subjects";
import { PageHero, SectionHead } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { JsonLd } from "@/components/json-ld";

// Titles written with Urdu-only letters (ی ہ ٹ ڈ ک گ ...) are set in Nastaliq; the rest in Naskh.
const isUrdu = (t: string) => /[ٹڈڑکگںھہیے]/.test(t);

export const generateStaticParams = () => SUBJECTS.map((s) => ({ slug: s.slug }));

export async function generateMetadata({ params }: PageProps<"/[locale]/subjects/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const s = subjectBySlug(slug);
  if (!isLocale(locale) || !s) return { title: "Not found", robots: { index: false } };
  return {
    title: `${s.en} (${s.ar}): what it covers, texts and how to study it`,
    description: `${s.field} ${s.overview[0].slice(0, 120)}`,
    alternates: alternatesFor(locale, `/subjects/${s.slug}`),
  };
}

export default async function SubjectGuidePage({ params }: PageProps<"/[locale]/subjects/[slug]">) {
  const { locale, slug } = await params;
  const s = subjectBySlug(slug);
  if (!isLocale(locale) || !s) notFound();
  const pairs = s.pairs.flatMap((p) => { const x = subjectBySlug(p); return x ? [x] : []; });
  const idx = SUBJECTS.findIndex((x) => x.slug === s.slug);
  const next = SUBJECTS[(idx + 1) % SUBJECTS.length];
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "Subjects", path: href(locale, "/subjects") }, { label: s.en, path: href(locale, `/subjects/${s.slug}`) }]}
        eyebrow="Subject guide" native={s.ar} nativeLang="ar" title={s.en} blurb={s.field}
      >
        <dl className="grid max-w-3xl gap-x-10 gap-y-4 border-t border-gold/30 pt-5 text-sm sm:grid-cols-3">
          <div><dt className="text-xs uppercase tracking-[0.2em] text-gold">Usually met</dt><dd className="mt-1 text-white/85">{s.stage}</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.2em] text-gold">Texts listed</dt><dd className="mt-1 text-white/85">{s.texts.length} commonly studied</dd></div>
          <div><dt className="text-xs uppercase tracking-[0.2em] text-gold">Pairs with</dt><dd className="mt-1 text-white/85">{pairs.map((p) => p.en).join(", ")}</dd></div>
        </dl>
      </PageHero>

      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
          <div className="prose-ilm !max-w-none">
            <h2>What is {s.en}?</h2>
            {s.overview.map((t, i) => <p key={i} className={i === 0 ? "dropcap text-xl" : ""}>{t}</p>)}
          </div>
          <aside className="self-start rounded-[10px] border border-gold-deep/40 bg-sheet p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">Pitfalls to avoid</p>
            <ul className="mt-4 space-y-4">
              {s.pitfalls.map((t) => (
                <li key={t} className="flex gap-3 text-sm leading-relaxed text-ink/85"><span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-vermilion" />{t}</li>
              ))}
            </ul>
          </aside>
        </div>
      </div>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <SectionHead eyebrow="Syllabus" title={<>What you will <em className="text-primary">learn</em></>} />
          <ol className="mt-10 grid gap-x-16 md:grid-cols-2">
            {s.learn.map((t, i) => (
              <li key={t} className="flex gap-5 border-b border-line py-5">
                <span aria-hidden="true" className="font-display w-9 shrink-0 text-4xl leading-none text-vermilion">{i + 1}</span>
                <span className="leading-relaxed text-ink/85">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead eyebrow="The books" title={<>Texts commonly <em className="text-primary">studied</em></>}
          lead="Boards and schools differ in which texts they set in which year. These are the titles most often met for this subject." />
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {s.texts.map((t) => (
            <li key={t.name} className="grid items-baseline gap-x-8 gap-y-2 py-6 md:grid-cols-[minmax(0,18rem)_1fr]">
              <div>
                {t.ar && (isUrdu(t.ar) ? <p lang="ur" dir="rtl" className="urdu text-start text-3xl text-primary-dark">{t.ar}</p> : <p lang="ar" dir="rtl" className="arabic-title text-start text-3xl text-primary-dark">{t.ar}</p>)}
                <p className="font-display text-2xl">{t.name}</p>
                {t.by && <p className="text-sm text-muted">{t.by}</p>}
              </div>
              <p className="leading-relaxed text-ink/80">{t.note}</p>
            </li>
          ))}
        </ul>
      </div>

      <section className="khatam relative text-white">
        <div className="relative mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Method</p>
          <h2 className="mt-3 max-w-2xl text-4xl sm:text-5xl">How to study <em className="gold-shimmer">{s.en}</em></h2>
          <ol className={`mt-12 grid gap-px overflow-hidden rounded-[10px] border border-white/15 bg-white/15 ${s.method.length === 4 ? "md:grid-cols-2 lg:grid-cols-4" : s.method.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            {s.method.map((m, i) => (
              <li key={m.t} className="bg-primary-dark/90 p-7 backdrop-blur">
                <span aria-hidden="true" className="gold-shimmer font-display text-5xl leading-none">{i + 1}</span>
                <h3 className="font-display mt-4 text-2xl">{m.t}</h3>
                <p className="mt-2 leading-relaxed text-white/75">{m.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-16">
        <SectionHead eyebrow="Questions" title="Common questions" />
        <div className="mt-8 divide-y divide-line border-y border-line">
          {s.faq.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}<span aria-hidden="true" className="relative h-4 w-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:bg-gold-deep after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:bg-gold-deep after:transition-transform group-open:after:scale-y-0" />
              </summary>
              <p className="mt-3 max-w-2xl leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">Read next</p>
            <Link href={href(locale, `/subjects/${next.slug}`)} className="group mt-2 flex items-baseline gap-4">
              <span lang="ar" dir="rtl" className="arabic-title text-4xl text-primary-dark">{next.ar}</span>
              <span className="font-display text-2xl underline-offset-4 group-hover:underline">{next.en}</span>
            </Link>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">Pairs well with</p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {pairs.map((p) => <li key={p.slug}><Link className="font-display text-2xl underline-offset-4 hover:underline" href={href(locale, `/subjects/${p.slug}`)}>{p.en}</Link></li>)}
            </ul>
          </div>
        </div>
      </div>

      <CtaBand eyebrow={s.en} title={<>Find {s.en} books <em className="gold-shimmer">in the library.</em></>}
        text="Choose your board and darja to see the books and notes filed under this subject."
        primary={{ label: "Open the library", href: href(locale, "/library") }} secondary={{ label: "See courses", href: href(locale, "/courses") }} />

      <JsonLd data={{
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: s.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }} />
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article", headline: `${s.en}: what it covers and how to study it`,
        url: absoluteUrl(href(locale, `/subjects/${s.slug}`)), inLanguage: "en", about: s.en,
      }} />
    </main>
  );
}
