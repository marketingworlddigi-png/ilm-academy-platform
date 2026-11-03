import Link from "next/link";
import { href, isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { listBoards, listLevels, listSubjectsForLevel, nameFor } from "@/modules/library/queries";
import { listActivePlans, type Plan } from "@/modules/payments/queries";
import { formatPkr, periodLabel } from "@/modules/payments/format";
import { Badge, Button, Card, CourseCard, DarjaCard } from "@/components/ui";

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
  const [boards, plans, coursesRes] = await Promise.all([
    listBoards(db),
    listActivePlans(db),
    db.from("courses").select("id, slug, title, summary, academies!inner(slug, name)")
      .eq("status", "published").is("deleted_at", null).order("published_at", { ascending: false }).limit(3),
  ]);
  const board = boards[0] ?? null;
  const levels = board ? await listLevels(db, board.id) : [];
  const counts = await Promise.all(levels.map(async (l) => (await listSubjectsForLevel(db, l.id)).length));
  const courses = (coursesRes.data ?? []).flatMap((c) => { const a = [c.academies].flat()[0]; return a ? [{ ...c, academy: a }] : []; });
  const saving = savingPercent(plans);

  return (
    <main>
      <section className="star-pattern text-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <p className="inline-block rounded-full border border-white/25 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold">Darse Nizami · Online</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">Your whole madrasa syllabus, in one place.</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            Books, notes and courses from independent academies and teachers, organised by board, level and subject.
            Every book is published only after its distribution permission has been verified.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={href(locale, "/signup")} variant="gold" size="lg">Start learning free</Button>
            <Button href={href(locale, "/library")} variant="outline" size="lg">Browse the library</Button>
          </div>
        </div>
      </section>

      {levels.length > 0 && board && (
        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{nameFor(board, locale)}</p>
              <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Start from your darja</h2>
            </div>
            <Link href={href(locale, "/library")} className="text-sm font-semibold text-primary hover:underline">Full library →</Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {levels.slice(0, 8).map((l, i) => (
              <DarjaCard key={l.id} href={href(locale, `/library/${board.slug}/${l.slug}`)} number={i + 1}
                nameUr={l.name_ur} nameLatin={l.name_en}
                subtitle={counts[i] > 0 ? `${counts[i]} ${counts[i] === 1 ? "subject" : "subjects"}` : "Syllabus coming soon"} />
            ))}
          </ul>
        </section>
      )}

      {courses.length > 0 && (
        <section className="border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-bold sm:text-3xl">Courses from trusted academies</h2>
              <Link href={href(locale, "/courses")} className="text-sm font-semibold text-primary hover:underline">All courses →</Link>
            </div>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <CourseCard key={c.id} href={href(locale, `/courses/${c.academy.slug}/${c.slug}`)} premium={false}
                  title={c.title} byline={c.academy.name} meta={c.summary ?? undefined} />
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">How Ilm Academy works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <Card as="li" key={title} className="p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Step {i + 1}</p>
              <h3 className="mt-2 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted">{text}</p>
            </Card>
          ))}
        </ol>
      </section>

      <section className="bg-primary-dark text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold">For madaris and academies</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Run your academy on one platform</h2>
            <ul className="mt-5 space-y-2 text-white/85">
              <li>Your own courses, lessons and teachers</li>
              <li>Students and progress kept separate from every other academy</li>
              <li>Books and notes with recorded distribution permission</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href={href(locale, "/academy/register")} variant="gold">Register your academy</Button>
            </div>
          </div>
          <Card className="p-5 text-ink">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Academy dashboard</p>
            <p className="mt-2 text-sm text-muted">Courses, teachers, students and payments in one place, visible only to your academy.</p>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">Simple pricing</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          <Card as="li" className="flex flex-col p-6">
            <h3 className="text-lg font-semibold">Free</h3>
            <p className="mt-3 text-3xl font-bold">PKR 0</p>
            <p className="mt-3 text-sm text-muted">Every book and course marked Free, with an account.</p>
            <Button href={href(locale, "/signup")} variant="outline" className="mt-auto">Create account</Button>
          </Card>
          {plans.map((p) => {
            const best = p.duration_months === 12;
            return (
              <li key={p.id} className={`flex flex-col rounded-[14px] border p-6 ${best ? "border-primary-dark bg-primary-dark text-white" : "border-line bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {best && saving !== null && <Badge tone="gold">Save ~{saving}%</Badge>}
                </div>
                <p className="mt-3 text-3xl font-bold">{formatPkr(p.price_paisa)} <span className={`text-base font-normal ${best ? "text-white/70" : "text-muted"}`}>{periodLabel(p.duration_months)}</span></p>
                {p.description && <p className={`mt-3 text-sm ${best ? "text-white/80" : "text-muted"}`}>{p.description}</p>}
                <Button href={href(locale, `/checkout/${p.code}`)} variant={best ? "gold" : "primary"} className="mt-auto">Choose {p.name}</Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-3xl px-5 py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">Questions</h2>
          <div className="mt-6 divide-y divide-line rounded-[14px] border border-line">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary>
                <p className="mt-2 text-sm text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
