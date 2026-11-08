import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { nameFor, listBoards, listLevels } from "@/modules/library/queries";
import { EmptyState } from "@/components/ui";
import { GeoStar } from "@/components/ornaments";
import { PageHero, SectionHead } from "@/components/page-hero";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]/library">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "Library: books and notes by board, level and subject",
    description: "Browse books and study notes organised by board, level and subject. Every resource is listed only after its distribution permission has been verified.",
    alternates: alternatesFor(locale, "/library"),
  };
}

const STEPS: Array<[string, string]> = [
  ["Board", "The body whose syllabus you follow."],
  ["Darja", "Your year of study within that board."],
  ["Subject", "Nahw, Fiqh, Hadith and the rest of the year's subjects."],
  ["Book", "Texts and notes, each with its permission on record."],
];

export default async function LibraryPage({ params }: PageProps<"/[locale]/library">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const db = createPublicClient();
  const boards = await listBoards(db);
  const levelCounts = await Promise.all(boards.map(async (b) => (await listLevels(db, b.id)).length));
  return (
    <main>
      <PageHero
        crumbs={[{ label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") }]}
        eyebrow="The library" native="کتب خانہ"
        title={<>Every book, <em className="gold-shimmer pe-2">in its place.</em></>}
        blurb="Choose a board, then your darja and subject, to find books and notes. A book is listed only after its distribution permission has been verified."
      />
      <div className="mx-auto max-w-6xl px-5 py-16">
        <ol aria-label="How the library is organised" className="mb-16 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="bg-sheet p-5">
              <span aria-hidden="true" className="font-display text-4xl leading-none text-vermilion">{i + 1}</span>
              <p className="mt-2 font-semibold">{t}</p>
              <p className="text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
        <SectionHead eyebrow="Choose a board" title={<>Start with <em className="text-primary">your syllabus</em></>} />
        <div className="mt-10">
          {boards.length === 0 ? (
            <EmptyState title="The library is being prepared.">Books appear here once their distribution permissions are verified.</EmptyState>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2">
              {boards.map((b, i) => (
                <li key={b.id}>
                  <Link href={href(locale, `/library/${b.slug}`)} className="khatam group relative flex h-full min-h-[18rem] flex-col overflow-hidden rounded-[10px] border border-primary-dark p-8 text-white shadow-[0_30px_60px_-34px_rgba(6,42,32,0.8)] transition-[transform,box-shadow] duration-300 hover:shadow-[0_40px_70px_-30px_rgba(6,42,32,0.95)] motion-safe:hover:-translate-y-1">
                    <GeoStar className="absolute -end-16 -top-16 h-72 w-72 opacity-50 transition-opacity duration-500 group-hover:opacity-90" />
                    <span aria-hidden="true" className="gold-shimmer font-display relative text-7xl leading-none">{i + 1}</span>
                    <span className="font-display relative mt-6 block text-4xl leading-tight sm:text-5xl">{nameFor(b, locale)}</span>
                    {b.description && <span className="relative mt-3 block max-w-md text-white/75">{b.description}</span>}
                    <span className="relative mt-auto flex items-center justify-between gap-4 pt-8">
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">{levelCounts[i] > 0 ? `${levelCounts[i]} ${levelCounts[i] === 1 ? "darja" : "darajat"}` : "Syllabus coming soon"}</span>
                      <span className="flex items-center gap-2 whitespace-nowrap font-semibold text-gold">Open board <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5 rtl:rotate-180 rtl:group-hover:-translate-x-1.5">&rarr;</span></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="mt-16 grid gap-6 rounded-[10px] border border-gold-deep/40 bg-sheet p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">Our promise on books</p>
            <p className="font-display mt-2 text-3xl leading-snug">If we cannot show the permission, we do not publish the book.</p>
            <p className="mt-2 max-w-2xl text-muted">Every title in the library carries a recorded licence or publisher permission. Read how that check works on the copyright page.</p>
          </div>
          <Link href={href(locale, "/copyright")} className="inline-flex items-center justify-center rounded-[6px] bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-dark">Copyright and permissions</Link>
        </aside>
      </div>
    </main>
  );
}
