import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";
import { getBoard, getLevel, getSubjectBySlug, listBooks, listSubjectsForLevel, nameFor } from "@/modules/library/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BookCard } from "@/components/book-card";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 300;

async function load(b: string, lv: string, sub: string) {
  const db = createPublicClient();
  const board = await getBoard(db, b);
  const level = board ? await getLevel(db, board.id, lv) : null;
  const subject = level ? await getSubjectBySlug(db, sub) : null;
  // The subject must actually be offered at this level, otherwise the URL is not a real catalog page.
  const offered = level && subject ? (await listSubjectsForLevel(db, level.id)).some((s) => s.id === subject.id) : false;
  return { db, board, level, subject: offered ? subject : null };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/library/[board]/[level]/[subject]">): Promise<Metadata> {
  const { locale, board: b, level: lv, subject: sub } = await params;
  if (!isLocale(locale)) return {};
  const { board, level, subject } = await load(b, lv, sub);
  if (!board || !level || !subject) return { title: "Not found", robots: { index: false } };
  return {
    title: `${nameFor(subject, locale)} books: ${nameFor(level, locale)}, ${nameFor(board, locale)}`,
    description: `Books and notes for ${subject.name_en} at ${level.name_en} (${board.name_en}).`,
    alternates: alternatesFor(locale, `/library/${board.slug}/${level.slug}/${subject.slug}`),
  };
}

export default async function SubjectPage({ params }: PageProps<"/[locale]/library/[board]/[level]/[subject]">) {
  const { locale, board: b, level: lv, subject: sub } = await params;
  if (!isLocale(locale)) notFound();
  const { db, board, level, subject } = await load(b, lv, sub);
  if (!board || !level || !subject) notFound();
  const books = await listBooks(db, { levelId: level.id, subjectId: subject.id });
  const base = `/library/${board.slug}/${level.slug}`;
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <Breadcrumbs crumbs={[
        { label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") },
        { label: nameFor(board, locale), path: href(locale, `/library/${board.slug}`) },
        { label: nameFor(level, locale), path: href(locale, base) },
        { label: nameFor(subject, locale), path: href(locale, `${base}/${subject.slug}`) },
      ]} />
      <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{nameFor(subject, locale)}</h1>
      <p className="mt-2 text-ink-soft">{nameFor(level, locale)} · {nameFor(board, locale)}</p>
      {books.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line p-6 text-ink-soft">No books are listed here yet. Books appear once their distribution permissions are verified.</p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{books.map((bk) => <BookCard key={bk.id} book={bk} locale={locale} />)}</ul>
      )}
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "CollectionPage", name: `${subject.name_en}: ${level.name_en}`,
        url: absoluteUrl(href(locale, `${base}/${subject.slug}`)),
        mainEntity: { "@type": "ItemList", itemListElement: books.map((bk, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(href(locale, `/books/${bk.id}`)), name: bk.title })) },
      }} />
    </main>
  );
}
