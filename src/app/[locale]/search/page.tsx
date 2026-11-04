import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { createPublicClient } from "@/lib/supabase/public";
import { BOOK_COLUMNS } from "@/modules/library/queries";
import { Card, CourseCard, EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

// Characters that have meaning inside a PostgREST filter or an ILIKE pattern are removed rather than escaped.
const clean = (s: string) => s.replace(/[,()%_*\\"'`;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = (await searchParams).q;
  const q = clean(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "");
  const db = createPublicClient();
  const [books, courses] = q.length < 2 ? [[], []] : await Promise.all([
    db.from("resources").select(BOOK_COLUMNS).eq("status", "published")
      .or(`title.ilike.%${q}%,title_ur.ilike.%${q}%,title_ar.ilike.%${q}%,author.ilike.%${q}%`).order("title").limit(30).then((r) => r.data ?? []),
    db.from("courses").select("id, slug, title, summary, academies!inner(slug, name)").eq("status", "published").is("deleted_at", null)
      .ilike("title", `%${q}%`).limit(12).then((r) => (r.data ?? []).flatMap((c) => { const a = [c.academies].flat()[0]; return a ? [{ ...c, academy: a }] : []; })),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <PageHeader title={q ? `Results for “${q}”` : "Search"} eyebrow="Library and courses" />
      <form action={href(locale, "/search")} role="search" className="mt-5 flex max-w-xl gap-2">
        <input name="q" defaultValue={q} className="field flex-1" placeholder="Book, subject, author or course" aria-label="Search" />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      {q.length < 2 ? <div className="mt-8"><EmptyState title="Type at least two letters to search." /></div>
        : books.length === 0 && courses.length === 0 ? <div className="mt-8"><EmptyState title="Nothing found.">Try a shorter word, or browse the library by darja.</EmptyState></div>
        : (
          <>
            {courses.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">Courses</h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.map((c) => <CourseCard key={c.id} href={href(locale, `/courses/${c.academy.slug}/${c.slug}`)} premium={false} title={c.title} byline={c.academy.name} meta={c.summary ?? undefined} />)}
                </ul>
              </section>
            )}
            {books.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">Books</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {books.map((b) => (
                    <Card as="li" key={b.id} className="p-4">
                      <Link href={href(locale, `/books/${b.id}`)} className="font-semibold text-ink hover:text-primary">{(locale === "ur-pk" ? b.title_ur : locale === "ar" ? b.title_ar : null) || b.title}</Link>
                      {b.author && <p className="mt-1 text-sm text-muted">{b.author}</p>}
                    </Card>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
    </main>
  );
}
