import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { getBoard, getLevel, listSubjectsForLevel, nameFor } from "@/modules/library/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const revalidate = 300;

async function load(slug: string, levelSlug: string) {
  const db = createPublicClient();
  const board = await getBoard(db, slug);
  const level = board ? await getLevel(db, board.id, levelSlug) : null;
  return { db, board, level };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/library/[board]/[level]">): Promise<Metadata> {
  const { locale, board: b, level: lv } = await params;
  if (!isLocale(locale)) return {};
  const { board, level } = await load(b, lv);
  if (!board || !level) return { title: "Not found", robots: { index: false } };
  return {
    title: `${nameFor(level, locale)} (${nameFor(board, locale)}): subjects and books`,
    description: `Subjects and books for ${level.name_en}, ${board.name_en}.`,
    alternates: alternatesFor(locale, `/library/${board.slug}/${level.slug}`),
  };
}

export default async function LevelPage({ params }: PageProps<"/[locale]/library/[board]/[level]">) {
  const { locale, board: b, level: lv } = await params;
  if (!isLocale(locale)) notFound();
  const { db, board, level } = await load(b, lv);
  if (!board || !level) notFound();
  const subjects = await listSubjectsForLevel(db, level.id);
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <Breadcrumbs crumbs={[
        { label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") },
        { label: nameFor(board, locale), path: href(locale, `/library/${board.slug}`) },
        { label: nameFor(level, locale), path: href(locale, `/library/${board.slug}/${level.slug}`) },
      ]} />
      <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{nameFor(level, locale)}</h1>
      {subjects.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line p-6 text-ink-soft">No subjects have been added to this level yet.</p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <li key={s.id} className="rounded-xl border border-line p-5">
              <Link href={href(locale, `/library/${board.slug}/${level.slug}/${s.slug}`)} className="font-semibold text-brand underline">{nameFor(s, locale)}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
