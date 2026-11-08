import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { PageHero, SectionHead } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";

export async function generateMetadata({ params }: PageProps<"/[locale]/for-academies">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "For academies and teachers: publish Darse Nizami courses online",
    description: "Register your academy, publish lesson-by-lesson courses with quizzes and assignments, answer student questions and issue verifiable completion certificates.",
    alternates: alternatesFor(locale, "/for-academies"),
  };
}

const STEPS: Array<{ t: string; d: string }> = [
  { t: "Register your academy", d: "Tell us who you are, who teaches and which subjects you offer. Your application is reviewed before anything is published." },
  { t: "Build a course", d: "Add lessons in order. Attach a video or reading, write the notes, and set a quiz or assignment where it helps." },
  { t: "Teach and answer", d: "Students ask questions under each lesson. You answer in the open, so every student sees the explanation." },
  { t: "Issue certificates", d: "When a student finishes, a completion certificate is issued with a code anyone can check." },
];

const TOOLS: Array<[string, string]> = [
  ["Courses and lessons", "Structure a course as ordered lessons, each with a video link, notes and, if you wish, a linked book from the library."],
  ["Quizzes", "Check understanding after a lesson and see how the class is doing."],
  ["Assignments", "Collect written work and review it with feedback."],
  ["Questions and answers", "A thread under each lesson keeps explanations where the next student will find them, with tools to hide a post."],
  ["Certificates", "Verifiable completion certificates, each with its own code."],
  ["Academy console", "One place to manage your courses, lessons and students."],
];

export default async function ForAcademiesPage({ params }: PageProps<"/[locale]/for-academies">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "For academies", path: href(locale, "/for-academies") }]}
        eyebrow="For academies and teachers" native="اساتذہ کے لیے"
        title={<>Teach the syllabus <em className="gold-shimmer pe-2">you already teach.</em></>}
        blurb="Ilm Academy gives madrasas and individual teachers a place to publish their courses online, organised by the same board, darja and subject their students already know."
      />

      <div className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead eyebrow="How it works" title={<>From application to <em className="text-primary">first class</em></>} />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="bg-sheet p-7">
              <span aria-hidden="true" className="font-display text-6xl leading-none text-vermilion">{i + 1}</span>
              <h3 className="font-display mt-4 text-2xl leading-tight">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>

      <section className="khatam relative text-white">
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">The toolkit</p>
            <h2 className="mt-3 text-4xl sm:text-5xl">What you get <em className="gold-shimmer">on day one</em></h2>
            <p className="mt-5 text-lg text-white/75">Everything needed to run a course from first lesson to certificate, without building your own site.</p>
          </div>
          <dl className="divide-y divide-white/15 border-y border-white/15">
            {TOOLS.map(([t, d]) => (
              <div key={t} className="grid gap-x-8 gap-y-1 py-5 sm:grid-cols-[13rem_1fr]">
                <dt className="font-display text-2xl text-gold">{t}</dt>
                <dd className="leading-relaxed text-white/75">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-16">
        <SectionHead eyebrow="Our standard" title={<>What we ask of <em className="text-primary">every academy</em></>} />
        <div className="prose-ilm !max-w-none">
          <p>Students trust a named teacher. We ask each academy to say who teaches, which texts they teach and which board or tradition the course follows. New academies are reviewed before they can publish.</p>
          <p>Where a course uses books, we ask that you have the right to share them, and the library shows the permission on record.</p>
          <p>We ask academies to describe their certificates honestly, as a record of completing that course.</p>
        </div>
      </div>

      <CtaBand eyebrow="Teach with us" title={<>Register <em className="gold-shimmer">your academy.</em></>}
        text="The application takes a few minutes. We review it, and once approved you can publish your first course."
        primary={{ label: "Register your academy", href: href(locale, "/academy/register") }} secondary={{ label: "How students learn", href: href(locale, "/how-it-works") }} />
    </main>
  );
}
