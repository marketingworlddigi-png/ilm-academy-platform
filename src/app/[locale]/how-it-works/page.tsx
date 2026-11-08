import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { HOW_STEPS } from "@/content/site-pages";
import { PageHero, SectionHead } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";

export async function generateMetadata({ params }: PageProps<"/[locale]/how-it-works">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "How Ilm Academy works for students",
    description: "From choosing your board and darja to finishing a course: how the library, courses, quizzes, notes and certificates fit together.",
    alternates: alternatesFor(locale, "/how-it-works"),
  };
}

const TOOLS: Array<[string, string]> = [
  ["Reader", "Books open in the browser reader, page by page, with nothing to download or install."],
  ["Notes", "Keep personal notes beside each lesson. They stay private to your account."],
  ["Questions", "Ask a question under a lesson and read the answers given by the teacher and other students."],
  ["Quizzes", "Short quizzes after a lesson show what has stuck and what needs another pass."],
  ["Assignments", "Written work is submitted to the teacher for review."],
  ["Certificate", "Finishing a course can issue a certificate with a code that anyone can verify."],
];

export default async function HowItWorksPage({ params }: PageProps<"/[locale]/how-it-works">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "How it works", path: href(locale, "/how-it-works") }]}
        eyebrow="For students" native="طریقہ"
        title={<>Four steps from <em className="gold-shimmer pe-2">first page</em> to finished course.</>}
        blurb="Ilm Academy is built around the way a student moves through the syllabus: choose the year, find the books, study with a teacher, and prove what you have learned."
      />

      <div className="mx-auto max-w-6xl px-5 py-16">
        <ol className="space-y-0">
          {HOW_STEPS.map((s) => (
            <li key={s.n} className="grid gap-x-12 gap-y-4 border-t border-line py-12 first:border-t-0 first:pt-0 md:grid-cols-[8rem_1fr_1fr]">
              <span aria-hidden="true" className="font-display text-8xl leading-none text-vermilion">{s.n}</span>
              <div>
                <h2 className="text-4xl leading-tight">{s.title}</h2>
                <p className="mt-3 text-lg leading-relaxed text-muted">{s.text}</p>
              </div>
              <ul className="space-y-3 self-center md:border-s md:border-line md:ps-10">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-3 leading-relaxed text-ink/85"><span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" />{p}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>

      <section className="khatam relative text-white">
        <div className="relative mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Inside a lesson</p>
          <h2 className="mt-3 max-w-2xl text-4xl sm:text-5xl">Everything a student needs, <em className="gold-shimmer">beside the text</em></h2>
          <dl className="mt-12 grid gap-px overflow-hidden rounded-[10px] border border-white/15 bg-white/15 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(([t, d]) => (
              <div key={t} className="bg-primary-dark/90 p-7">
                <dt className="font-display text-3xl text-gold">{t}</dt>
                <dd className="mt-2 leading-relaxed text-white/75">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-16">
        <SectionHead eyebrow="Plans" title={<>Free first, <em className="text-primary">Premium when you need it</em></>} />
        <div className="prose-ilm !max-w-none">
          <p>An account is free. Every book and course marked Free opens with it. Premium unlocks the titles marked Premium for as long as your plan lasts.</p>
          <p>Payment is by bank transfer, JazzCash or Easypaisa. You pay, upload the proof of payment, and a person verifies it. Your payments page shows the status at every stage.</p>
        </div>
      </div>

      <CtaBand eyebrow="Start now" title={<>Create your account <em className="gold-shimmer">and begin.</em></>}
        text="It is free to join. You can browse the library without an account and sign up when you are ready to read."
        primary={{ label: "Create a free account", href: href(locale, "/signup") }} secondary={{ label: "See plans", href: href(locale, "/pricing") }} />
    </main>
  );
}
