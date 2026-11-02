import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { getBoard, listLevels, nameFor } from "@/modules/library/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]/library/[board]">): Promise<Metadata> {
  const { locale, board: slug } = await params;
  if (!isLocale(locale)) return {};
  const board = await getBoard(createPublicClient(), slug);
  if (!board) return { title: "Not found", robots: { index: false } };
  return {
    title: `${nameFor(board, locale)}: levels and books`,
    description: board.description ?? `Levels, subjects and books for ${board.name_en}.`,
    alternates: alternatesFor(locale, `/library/${board.slug}`),
  };
}

export default async function BoardPage({ params }: PageProps<"/[locale]/library/[board]">) {
  const { locale, board: slug } = await params;
  if (!isLocale(locale)) notFound();
  const db = createPublicClient();
  const board = await getBoard(db, slug);
  if (!board) notFound();
  const levels = await listLevels(db, board.id);
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <Breadcrumbs crumbs={[
        { label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") },
        { label: nameFor(board, locale), path: href(locale, `/library/${board.slug}`) },
      ]} />
      <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{nameFor(board, locale)}</h1>
      {board.description && <p className="mt-2 max-w-2xl text-ink-soft">{board.description}</p>}
      {levels.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line p-6 text-ink-soft">No levels have been added to this board yet.</p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {levels.map((l) => (
            <li key={l.id} className="rounded-xl border border-line p-5">
              <Link href={href(locale, `/library/${board.slug}/${l.slug}`)} className="font-semibold text-brand underline">{nameFor(l, locale)}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
