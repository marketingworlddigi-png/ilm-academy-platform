import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { getBoard, listLevels, listSubjectsForLevel, nameFor, splitLevelName } from "@/modules/library/queries";
import { EmptyState } from "@/components/ui";
import { DarjaContents } from "@/components/darja-contents";
import { PageHero, SectionHead } from "@/components/page-hero";

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
      <PageHero
        crumbs={[
          { label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") },
          { label: nameFor(board, locale), path: href(locale, `/library/${board.slug}`) },
        ]}
        eyebrow="Board" title={nameFor(board, locale)} blurb={board.description}
      />
      <div className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead eyebrow="Choose your darja" title={<>The course of study, <em className="text-primary">year by year</em></>} />
        <div className="mt-10">
          {levels.length === 0 ? <EmptyState title="No levels have been added to this board yet." /> : (
            <DarjaContents items={levels.map((l, i) => {
              const n = splitLevelName(l.name_en);
              const par = n.latin.includes("(") ? n.latin.slice(n.latin.indexOf("(")).replace(/[()]/g, "") : "";
              return {
                id: l.id, href: href(locale, `/library/${board.slug}/${l.slug}`), latin: n.latin.split("(")[0].trim(), ur: l.name_ur?.split("(")[0].trim() ?? null,
                note: [par, n.equiv, counts[i] > 0 ? `${counts[i]} ${counts[i] === 1 ? "subject" : "subjects"}` : "Syllabus coming soon"].filter(Boolean).join(" · "),
              };
            })} />
          )}
        </div>
      </div>
    </main>
  );
}
