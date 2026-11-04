import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { getBoard, listLevels, listSubjectsForLevel, nameFor, splitLevelName } from "@/modules/library/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DarjaCard, EmptyState } from "@/components/ui";

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
  const counts = await Promise.all(levels.map(async (l) => (await listSubjectsForLevel(db, l.id)).length));
  return (
    <main>
      <section className="bg-ink text-white star-pattern">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <div><Breadcrumbs tone="dark" crumbs={[
            { label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") },
            { label: nameFor(board, locale), path: href(locale, `/library/${board.slug}`) },
          ]} /></div>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{nameFor(board, locale)}</h1>
          {board.description && <p className="mt-2 max-w-2xl text-white/80">{board.description}</p>}
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <h2 className="text-2xl font-bold">Choose your darja</h2>
        {levels.length === 0 ? <div className="mt-5"><EmptyState title="No levels have been added to this board yet." /></div> : (
          <ul className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {levels.map((l, i) => (
              <DarjaCard key={l.id} href={href(locale, `/library/${board.slug}/${l.slug}`)} number={i + 1}
                nameUr={l.name_ur} nameLatin={splitLevelName(l.name_en).latin} tag={splitLevelName(l.name_en).equiv}
                subtitle={counts[i] > 0 ? `${counts[i]} ${counts[i] === 1 ? "subject" : "subjects"}` : "Syllabus coming soon"} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
