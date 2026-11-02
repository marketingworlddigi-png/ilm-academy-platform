import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { nameFor, listBoards } from "@/modules/library/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";

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

export default async function LibraryPage({ params }: PageProps<"/[locale]/library">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const boards = await listBoards(createPublicClient());
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <Breadcrumbs crumbs={[{ label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") }]} />
      <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">Library</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">Choose a board to find books and notes by level and subject.</p>
      {boards.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line p-6 text-ink-soft">The library is being prepared. Books appear here once their distribution permissions are verified.</p>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <li key={b.id} className="rounded-xl border border-line p-5">
              <Link href={href(locale, `/library/${b.slug}`)} className="font-display text-xl font-semibold text-brand underline">{nameFor(b, locale)}</Link>
              {b.description && <p className="mt-2 text-sm text-ink-soft">{b.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
