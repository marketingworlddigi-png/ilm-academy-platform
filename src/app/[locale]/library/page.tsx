import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { nameFor, listBoards } from "@/modules/library/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/ui";

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
    <main>
      <section className="bg-ink text-white star-pattern">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <div><Breadcrumbs tone="dark" crumbs={[{ label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") }]} /></div>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">Library</h1>
          <p className="mt-2 max-w-2xl text-white/80">Choose a board to find books and notes by darja and subject.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-5 py-10">
        {boards.length === 0 ? (
          <EmptyState title="The library is being prepared.">Books appear here once their distribution permissions are verified.</EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <li key={b.id}>
                <Link href={href(locale, `/library/${b.slug}`)} className="flex h-full flex-col rounded-[14px] border border-line bg-white p-5 transition-colors hover:border-primary">
                  <span className="text-xl font-bold text-primary">{nameFor(b, locale)}</span>
                  {b.description && <span className="mt-2 text-sm text-muted">{b.description}</span>}
                  <span className="mt-auto pt-3 text-sm font-semibold text-primary">Open board &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
