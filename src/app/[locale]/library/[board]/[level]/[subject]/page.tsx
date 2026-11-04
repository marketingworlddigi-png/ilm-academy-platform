import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";
import { getBoard, getLevel, getSubjectBySlug, listBooks, listSubjectsForLevel, nameFor } from "@/modules/library/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/ui";
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
    <main>
      <section className="bg-ink text-white star-pattern">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <div><Breadcrumbs tone="dark" crumbs={[
            { label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") },
            { label: nameFor(board, locale), path: href(locale, `/library/${board.slug}`) },
            { label: nameFor(level, locale), path: href(locale, base) },
            { label: nameFor(subject, locale), path: href(locale, `${base}/${subject.slug}`) },
          ]} /></div>
          {(subject.name_ar ?? subject.name_ur) && <p lang={subject.name_ar ? "ar" : "ur"} dir="rtl" className={`${subject.name_ar ? "arabic-title" : "urdu"} mt-4 w-fit text-3xl font-bold text-gold`}>{subject.name_ar ?? subject.name_ur}</p>}
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{subject.name_en}</h1>
          <p className="mt-2 text-white/80">{nameFor(level, locale)} &middot; {nameFor(board, locale)}</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-5 py-10">
        {books.length === 0 ? (
          <EmptyState title="No books are listed here yet.">Books appear once their distribution permissions are verified.</EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{books.map((bk) => <BookCard key={bk.id} book={bk} locale={locale} />)}</ul>
        )}
      </div>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "CollectionPage", name: `${subject.name_en}: ${level.name_en}`,
        url: absoluteUrl(href(locale, `${base}/${subject.slug}`)),
        mainEntity: { "@type": "ItemList", itemListElement: books.map((bk, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(href(locale, `/books/${bk.id}`)), name: bk.title })) },
      }} />
    </main>
  );
}
