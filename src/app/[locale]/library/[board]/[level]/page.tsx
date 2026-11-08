import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { getBoard, getLevel, countBooksBySubject, listSubjectsForLevel, nameFor, splitLevelName } from "@/modules/library/queries";
import { Badge, EmptyState, SubjectCard } from "@/components/ui";
import { PageHero, SectionHead } from "@/components/page-hero";

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
  const [subjects, bookCounts] = await Promise.all([listSubjectsForLevel(db, level.id), countBooksBySubject(db, level.id)]);
  const equiv = splitLevelName(level.name_en).equiv;
  return (
    <main>
      <PageHero
        crumbs={[
          { label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") },
          { label: nameFor(board, locale), path: href(locale, `/library/${board.slug}`) },
          { label: nameFor(level, locale), path: href(locale, `/library/${board.slug}/${level.slug}`) },
        ]}
        eyebrow="Darja" native={level.name_ur} title={splitLevelName(level.name_en).latin}
      >
        <div className="flex flex-wrap gap-2"><Badge tone="gold">{nameFor(board, locale)}</Badge>{equiv && <Badge tone="neutral">Equivalent: {equiv}</Badge>}</div>
      </PageHero>
      <div className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead eyebrow="Syllabus" title="Subjects" lead="Pick a subject to see the books and notes filed under it for this year." />
        <div className="mt-10">
          {subjects.length === 0 ? <EmptyState title="No subjects have been added to this level yet." /> : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((s) => {
                const n = bookCounts.get(s.id) ?? 0;
                return (
                  <SubjectCard key={s.id} href={href(locale, `/library/${board.slug}/${level.slug}/${s.slug}`)}
                    nameNative={s.name_ar ?? s.name_ur} nativeLang={s.name_ar ? "ar" : "ur"} nameLatin={s.name_en}
                    subtitle={n > 0 ? `${n} ${n === 1 ? "book" : "books"}` : "Books coming soon"} />
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
