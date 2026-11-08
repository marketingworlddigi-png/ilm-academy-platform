import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { PageHero, SectionHead } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { GeoStar } from "@/components/ornaments";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "About Ilm Academy: the Darse Nizami, organised and taught online",
    description: "Why Ilm Academy exists, what it is building, how books are vetted for permission, and the principles behind the library and courses.",
    alternates: alternatesFor(locale, "/about"),
  };
}

const PRINCIPLES: Array<{ t: string; d: string }> = [
  { t: "Permission before publication", d: "A book enters the library only when a licence or publisher permission is on record. A shorter library with its permissions in order is better than a larger one built on guesswork." },
  { t: "The syllabus, not a substitute", d: "We arrange the course the way boards and madrasas arrange it, year by year, so that online study sits beside the classroom instead of replacing it." },
  { t: "Teachers, named", d: "Courses belong to academies and teachers who are identified, reviewed and approved. Learning from a named teacher is part of how this tradition has always worked." },
  { t: "Plain about what we are", d: "A completion certificate records a course completed. It is not a board qualification or an ijazah, and we say so wherever it matters." },
];

const PARTS: Array<{ t: string; ur: string; d: string; link: string; label: string }> = [
  { t: "The Library", ur: "کتب خانہ", d: "Books and notes filed by board, darja and subject, each with its access level and the permission behind it.", link: "/library", label: "Open the library" },
  { t: "The Courses", ur: "دورے", d: "Lesson-by-lesson courses from approved academies, with notes, quizzes, assignments and a place to ask questions.", link: "/courses", label: "Browse courses" },
  { t: "The Guides", ur: "رہنمائی", d: "Long-form guidance on the subjects and on how to study them: how to read a kitab, how to memorise, how to choose a course.", link: "/guides", label: "Read the guides" },
];

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "About", path: href(locale, "/about") }]}
        eyebrow="About us" native="ہمارا مقصد"
        title={<>The Darse Nizami, <em className="gold-shimmer pe-2">made reachable.</em></>}
        blurb="Ilm Academy brings the classical madrasa course into one organised place: the syllabus, the books, and the teachers, arranged the way a student actually moves through them."
      />

      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <SectionHead eyebrow="Why we exist" title={<>A good course is easy to find in a madrasa, <em className="text-primary">hard to find online</em></>} />
          <div className="prose-ilm !mt-0">
            <p className="dropcap text-xl">A student who wants to study the Darse Nizami usually has two options: enrol in a madrasa, or piece together videos, scans and PDFs from many places. The first is not possible for everyone. The second leaves the student without an order to follow, without any assurance about the books, and without a teacher to ask.</p>
            <p>Ilm Academy tries to close that gap. It arranges the syllabus year by year, files each book under the subject and darja where it is read, and gives academies a place to teach those books lesson by lesson.</p>
            <p>It is a marketplace in the plain sense that several academies can teach here, and a library in the sense that the books are kept in one order. It is not a replacement for a teacher; it is a way to find and study with one.</p>
          </div>
        </div>
      </div>

      <section className="khatam relative overflow-hidden text-white">
        <GeoStar className="absolute -end-32 -top-24 h-[30rem] w-[30rem] opacity-40" />
        <div className="relative mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Our principles</p>
          <h2 className="mt-3 max-w-2xl text-4xl sm:text-5xl">Four commitments we <em className="gold-shimmer">hold ourselves to</em></h2>
          <ol className="mt-12 grid gap-x-16 gap-y-10 md:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <li key={p.t} className="flex gap-6 border-t border-white/15 pt-6">
                <span aria-hidden="true" className="gold-shimmer font-display text-6xl leading-none">{i + 1}</span>
                <div>
                  <h3 className="font-display text-3xl">{p.t}</h3>
                  <p className="mt-2 leading-relaxed text-white/75">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead eyebrow="What is here" title={<>Three parts, <em className="text-primary">one study</em></>} />
        <ul className="mt-12 divide-y divide-line border-y border-line">
          {PARTS.map((p) => (
            <li key={p.t}>
              <Link href={href(locale, p.link)} className="group grid items-center gap-x-8 gap-y-2 py-8 transition-[padding] duration-300 hover:ps-3 md:grid-cols-[14rem_1fr_auto]">
                <span>
                  <span lang="ur" dir="rtl" className="urdu block text-start text-3xl font-bold text-primary-dark">{p.ur}</span>
                  <span className="font-display text-2xl">{p.t}</span>
                </span>
                <span className="max-w-xl leading-relaxed text-ink/80">{p.d}</span>
                <span className="font-semibold text-primary group-hover:underline">{p.label} <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-1 rtl:rotate-180">&rarr;</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-4xl px-5 py-16">
          <SectionHead eyebrow="A note on authority" title="What this site does not claim" />
          <div className="prose-ilm !max-w-none">
            <p>Ilm Academy is a study platform. It does not issue fatwas, and nothing on it replaces asking a qualified mufti about your own situation.</p>
            <p>It does not award board qualifications. The only certificates it can show are completion records issued by the academy that taught the course, and each one says what it is.</p>
            <p>The subject and guide pages describe texts that are commonly studied. Boards and schools differ in what they set and when, so use these pages to orient yourself and follow your own board or teacher for the precise syllabus.</p>
          </div>
        </div>
      </section>

      <CtaBand eyebrow="Join us" title={<>Study here, <em className="gold-shimmer">or teach here.</em></>}
        text="Create a free account to start reading, or register your academy to publish courses."
        primary={{ label: "Create a free account", href: href(locale, "/signup") }} secondary={{ label: "For academies", href: href(locale, "/for-academies") }} />
    </main>
  );
}
