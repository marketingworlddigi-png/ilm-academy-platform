import Link from "next/link";
import type { CSSProperties } from "react";
import { href, isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { listBoards, listLevels, listSubjectsForLevel, nameFor, splitLevelName as splitName } from "@/modules/library/queries";
import { listActivePlans, type Plan } from "@/modules/payments/queries";
import { formatPkr, periodLabel } from "@/modules/payments/format";
import { Badge, Button, Card, CourseCard } from "@/components/ui";
import { KitabPage } from "@/components/kitab-page";
import { GeoStar, SubjectMarquee } from "@/components/ornaments";
import { ContinueCard } from "@/components/continue-card";
import { courseIsPremium } from "@/modules/courses/access";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { alternates: alternatesFor(locale, "/") } : {};
}

const STEPS = [
  ["Pick your darja", "Choose the board and year you study. The library and courses follow the syllabus for that year."],
  ["Learn at your pace", "Watch lessons, read the book pages they point to, take the tests and keep your own notes."],
  ["Finish and get certified", "Complete every lesson and pass the tests to earn a certificate anyone can verify online."],
] as const;

const FAQ = [
  ["Which boards and darajat are covered?", "The library is organised by board and level. Boards and levels appear here as soon as their syllabus has been added, so an empty darja simply means it is still being prepared."],
  ["How do I pay with JazzCash or Easypaisa?", "Choose a plan, send the amount to the account shown at checkout, then enter the transaction ID from the SMS and upload the receipt. We check it and activate Premium once approved."],
  ["Can my madrasa use Ilm Academy?", "Yes. Register your academy, and once approved you can add teachers, publish courses and run your students, separate from every other academy."],
] as const;

const EYEBROW = "text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep";
const delay = (i: number) => ({ "--i": i }) as CSSProperties;

// Yearly saving against twelve monthly payments, computed from the live plan prices so it can never drift from the pricing table.
function savingPercent(plans: Plan[]): number | null {
  const monthly = plans.find((p) => p.duration_months === 1);
  const yearly = plans.find((p) => p.duration_months === 12);
  if (!monthly || !yearly) return null;
  const pct = Math.round((1 - yearly.price_paisa / (monthly.price_paisa * 12)) * 100);
  return pct > 0 ? pct : null;
}

// English copy only for now: Urdu and Arabic text will be added from human-reviewed translations, not machine output.
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const db = createPublicClient();
  const [boards, plans, coursesRes, courseCount, academyCount] = await Promise.all([
    listBoards(db),
    listActivePlans(db),
    db.from("courses").select("id, slug, title, summary, academies!inner(slug, name)")
      .eq("status", "published").is("deleted_at", null).order("published_at", { ascending: false }).limit(3),
    db.from("courses").select("id", { count: "exact", head: true }).eq("status", "published").is("deleted_at", null),
    db.from("academies").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
  ]);
  const board = boards[0] ?? null;
  const levels = board ? await listLevels(db, board.id) : [];
  const subjectLists = await Promise.all(levels.map((l) => listSubjectsForLevel(db, l.id)));
  const counts = subjectLists.map((x) => x.length);
  // Popular chips: the distinct subjects that actually exist in the syllabus, in syllabus order.
  const chips = [...new Map(subjectLists.flatMap((xs, i) => xs.map((x) => [x.id, { ...x, levelSlug: levels[i].slug }] as const))).values()].slice(0, 6);
  const courses = (coursesRes.data ?? []).flatMap((c) => { const a = [c.academies].flat()[0]; return a ? [{ ...c, academy: a }] : []; });
  const saving = savingPercent(plans);
  // Real totals only: a figure that is zero is left out rather than shown as "0".
  const stats = [
    { n: boards.length, label: boards.length === 1 ? "Board" : "Boards" },
    { n: counts.reduce((a, b) => a + b, 0), label: "Syllabus subjects" },
    { n: courseCount.count ?? 0, label: (courseCount.count ?? 0) === 1 ? "Published course" : "Published courses" },
    { n: academyCount.count ?? 0, label: (academyCount.count ?? 0) === 1 ? "Approved academy" : "Approved academies" },
  ].filter((x) => x.n > 0);

  return (
    <main>
      <section className="khatam overflow-hidden text-white">
        <GeoStar className="absolute -end-48 -top-40 h-[52rem] w-[52rem] opacity-40" />
        <GeoStar spin="spin-slower" className="absolute -bottom-72 -start-64 h-[44rem] w-[44rem] opacity-20" />
        <div className="relative mx-auto grid max-w-6xl gap-16 px-5 pb-24 pt-16 sm:pt-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="rise flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.3em] text-gold" style={delay(0)}><span aria-hidden="true" className="grow-x h-px w-14 bg-gold" />Darse Nizami · Online</p>
            <h1 className="rise mt-6 max-w-3xl text-[clamp(3rem,7.6vw,6.25rem)]" style={delay(1)}>
              Your whole madrasa syllabus, <em className="gold-shimmer pe-2">in one place.</em>
            </h1>
            <p lang="ur" dir="rtl" className="urdu rise mt-5 text-3xl text-gold sm:text-4xl" style={delay(2)}>درسِ نظامی، سال بہ سال</p>
            <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-white/75" style={delay(3)}>
              Books, notes and courses from independent academies and teachers, organised by board, level and subject.
              Every book is published only after its distribution permission has been verified.
            </p>
            <form action={href(locale, "/search")} role="search" className="rise mt-7 flex max-w-xl gap-2" style={delay(4)}>
              <input name="q" type="search" aria-label="Search books and courses" placeholder="Search a book, subject or course"
                className="min-w-0 flex-1 rounded-[10px] border border-white/20 bg-sheet px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold" />
              <Button type="submit" variant="gold">Search</Button>
            </form>
            {chips.length > 0 && (
              <div className="rise mt-4 flex flex-wrap items-center gap-2 text-sm" style={delay(5)}>
                <span className="text-white/70">Popular:</span>
                {chips.map((c) => (
                  <Link key={c.id} href={href(locale, `/library/${board!.slug}/${c.levelSlug}/${c.slug}`)} className="rounded-full border border-white/25 px-3 py-1 text-white/90 transition-colors hover:border-gold hover:text-gold">{nameFor(c, locale)}</Link>
                ))}
              </div>
            )}
            <div className="rise mt-7 flex flex-wrap gap-3" style={delay(6)}>
              <Button href={href(locale, "/signup")} variant="gold" size="lg">Start learning free</Button>
              <Button href={href(locale, "/library")} variant="outline" size="lg">Browse the library</Button>
            </div>
          </div>
          <div className="space-y-8">
            <KitabPage />
            <ContinueCard locale={locale} signupHref={href(locale, "/signup")} libraryHref={href(locale, "/library")} />
          </div>
        </div>
        <div className="relative"><SubjectMarquee /></div>
      </section>

      {stats.length > 1 && (
        <section aria-label="Ilm Academy in numbers" className="border-b border-line">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-5 py-8 md:grid-cols-4">
            {stats.map((x) => (
              <div key={x.label} className="flex flex-col-reverse border-s-2 border-gold ps-4">
                <dt className="text-sm text-muted">{x.label}</dt>
                <dd className="font-display text-6xl text-primary-dark">{x.n}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {boards.length > 0 && (
        <section className="border-b border-line bg-sheet/70">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-sm">
            <span className={EYEBROW}>Boards</span>
            {boards.map((b) => (
              <Link key={b.id} href={href(locale, `/library/${b.slug}`)} className="rounded-full border border-line bg-sheet px-3 py-1 font-semibold text-ink transition-colors hover:border-primary hover:text-primary">{nameFor(b, locale)}</Link>
            ))}
          </div>
        </section>
      )}

      {levels.length > 0 && board && (
        <section className="reveal mx-auto max-w-6xl px-5 py-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={EYEBROW}>{nameFor(board, locale)}</p>
              <h2 className="mt-2 text-4xl sm:text-6xl">Start from your <em className="text-primary">darja</em></h2>
            </div>
            <Link href={href(locale, "/library")} className="text-sm font-semibold text-primary hover:underline">Full library →</Link>
          </div>
          <div className="ornament mt-6"><span /></div>
          <ol className="mt-8 grid gap-x-16 md:grid-cols-2">
            {levels.slice(0, 8).map((l, i) => {
              const n = splitName(l.name_en);
              return (
                <li key={l.id} className="border-b border-line/80">
                  <Link href={href(locale, `/library/${board.slug}/${l.slug}`)} className="group relative flex items-end gap-3 py-5 transition-[padding] duration-200 hover:ps-3 focus-visible:outline-2 focus-visible:outline-primary">
                    <span aria-hidden="true" className="absolute inset-y-3 start-0 w-0.5 origin-center scale-y-0 bg-gold transition-transform duration-200 group-hover:scale-y-100" />
                    <span aria-hidden="true" className="font-display w-10 shrink-0 text-4xl leading-none text-vermilion">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-lg font-semibold leading-tight text-ink">{n.latin.split("(")[0].trim()}</span>
                      <span className="block text-xs text-muted">{n.latin.includes("(") ? `${n.latin.slice(n.latin.indexOf("(")).replace(/[()]/g, "")} · ` : ""}{n.equiv ? `${n.equiv} · ` : ""}{counts[i] > 0 ? `${counts[i]} ${counts[i] === 1 ? "subject" : "subjects"}` : "Syllabus coming soon"}</span>
                    </span>
                    <span aria-hidden="true" className="leader" />
                    {l.name_ur && <span lang="ur" dir="rtl" className="urdu shrink-0 whitespace-nowrap text-2xl font-bold text-primary-dark">{l.name_ur.split("(")[0].trim()}</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {levels.length > 1 && (
        <section className="khatam reveal overflow-hidden text-white">
          <GeoStar spin="spin-slower" className="absolute -end-32 top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 opacity-25" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-24 md:grid-cols-[auto_1fr] md:gap-16">
            <p aria-hidden="true" className="gold-shimmer font-display text-[clamp(9rem,22vw,17rem)] leading-[0.8]">{levels.length}</p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">The path</p>
              <h2 className="mt-3 max-w-xl text-4xl sm:text-6xl"><span className="sr-only">{levels.length} </span>darajat, one syllabus, <em className="text-gold">every book in its place.</em></h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">Follow the course of study year by year, from the first year to Daura-e-Hadith. Each darja lists its subjects, and each subject its books.</p>
              <div className="mt-8"><Button href={href(locale, "/library")} variant="gold" size="lg">Explore the library</Button></div>
            </div>
          </div>
        </section>
      )}

      {courses.length > 0 && (
        <section className="reveal border-y border-line bg-sheet/70">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-4xl sm:text-5xl">Courses from trusted academies</h2>
              <Link href={href(locale, "/courses")} className="text-sm font-semibold text-primary hover:underline">All courses →</Link>
            </div>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <CourseCard key={c.id} href={href(locale, `/courses/${c.academy.slug}/${c.slug}`)} premium={courseIsPremium(c)}
                  title={c.title} byline={c.academy.name} meta={c.summary ?? undefined} />
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="reveal mx-auto max-w-6xl px-5 py-20">
        <p className={EYEBROW}>How it works</p>
        <h2 className="mt-2 text-4xl sm:text-5xl">Three steps to a certificate</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="relative border-t border-gold-deep/50 pt-6 before:absolute before:-top-[5px] before:start-0 before:h-2.5 before:w-2.5 before:rotate-45 before:bg-gold">
              <span aria-hidden="true" className="font-display text-8xl leading-none text-primary/20">{i + 1}</span>
              <h3 className="mt-2 text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="khatam reveal overflow-hidden text-white">
        <GeoStar className="absolute -start-40 top-1/2 h-[40rem] w-[40rem] -translate-y-1/2 opacity-25" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">For madaris and academies</p>
            <h2 className="mt-3 text-4xl sm:text-5xl">Run your academy on one platform</h2>
            <ul className="mt-6 space-y-2 text-white/85">
              <li>Your own courses, lessons and teachers</li>
              <li>Students and progress kept separate from every other academy</li>
              <li>Books and notes with recorded distribution permission</li>
            </ul>
            <div className="mt-8"><Button href={href(locale, "/academy/register")} variant="gold" size="lg">Register your academy</Button></div>
          </div>
          <div aria-hidden="true" className="float-y rounded-[10px] bg-sheet p-5 text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-gold/40">
            <div className="flex flex-wrap gap-2 border-b border-line pb-3 text-xs font-semibold">
              {["Courses", "Teachers", "Students", "Payments"].map((t, i) => (
                <span key={t} className={`rounded-full px-3 py-1 ${i === 0 ? "bg-primary text-white" : "text-muted"}`}>{t}</span>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {["w-3/4", "w-full", "w-5/6", "w-2/3"].map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="h-8 w-8 shrink-0 rounded-[6px] bg-gold/50" />
                  <span className={`grow-x h-3 rounded-full bg-ink/10 ${w}`} style={{ animationDelay: `${0.4 + i * 0.15}s` }} />
                  <span className="ms-auto h-3 w-10 shrink-0 rounded-full bg-primary/20" />
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">Visible only to your academy.</p>
          </div>
        </div>
      </section>

      <section className="reveal mx-auto max-w-6xl px-5 py-20">
        <p className={EYEBROW}>Pricing</p>
        <h2 className="mt-2 text-4xl sm:text-5xl">Simple pricing</h2>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          <Card as="li" className="flex flex-col p-6">
            <h3 className="text-lg font-semibold">Free</h3>
            <p className="font-display mt-3 text-5xl">PKR 0</p>
            <p className="my-4 text-sm text-muted">Every book and course marked Free, with an account.</p>
            <Button href={href(locale, "/signup")} variant="outline" className="mt-auto">Create account</Button>
          </Card>
          {plans.map((p) => {
            const best = p.duration_months === 12;
            return (
              <li key={p.id} className={`relative flex flex-col rounded-[10px] border p-7 ${best ? "khatam gold-border border-primary-dark text-white shadow-[0_40px_80px_-30px_rgba(6,42,32,0.8)] md:-translate-y-3" : "border-line bg-sheet"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {best && saving !== null && <Badge tone="gold">Save ~{saving}%</Badge>}
                </div>
                <p className="font-display mt-3 text-5xl">{formatPkr(p.price_paisa)} <span className={`font-sans text-base ${best ? "text-white/70" : "text-muted"}`}>{periodLabel(p.duration_months)}</span></p>
                {p.description && <p className={`my-4 text-sm ${best ? "text-white/80" : "text-muted"}`}>{p.description}</p>}
                <Button href={href(locale, `/checkout/${p.code}`)} variant={best ? "gold" : "primary"} className="mt-auto">Choose {p.name}</Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="reveal border-t border-line bg-sheet/70">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-4xl sm:text-5xl">Questions</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold marker:hidden">
                  {q}
                  <span aria-hidden="true" className="font-display text-3xl leading-none text-gold-deep transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="khatam overflow-hidden text-center text-white">
        <GeoStar className="absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 opacity-30" />
        <div className="relative mx-auto max-w-3xl px-5 py-28">
          <p lang="ur" dir="rtl" className="urdu gold-shimmer text-6xl sm:text-8xl">علم حاصل کریں</p>
          <p className="mt-4 text-lg text-white/80">Begin with your darja today. Free lessons need only an account.</p>
          <div className="mt-8"><Button href={href(locale, "/signup")} variant="gold" size="lg">Start learning free</Button></div>
        </div>
      </section>
    </main>
  );
}
