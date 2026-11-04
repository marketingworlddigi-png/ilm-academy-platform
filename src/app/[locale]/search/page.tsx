import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { createPublicClient } from "@/lib/supabase/public";
import { searchLibrary, splitLevelName } from "@/modules/library/queries";
import { Card, CourseCard, EmptyState, PageHeader, SubjectCard } from "@/components/ui";
import { courseIsPremium } from "@/modules/courses/access";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

// Characters that have meaning inside a PostgREST filter or an ILIKE pattern are removed rather than escaped.
const clean = (s: string) => s.replace(/[,()%_*\\"'`;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

export default async function SearchPage({ params, searchParams }: PageProps<"/[locale]/search">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = (await searchParams).q;
  const q = clean(Array.isArray(raw) ? raw[0] ?? "" : raw ?? "");
  const db = createPublicClient();
  const [lib, courses] = q.length < 2 ? [{ subjects: [], books: [] }, []] : await Promise.all([
    searchLibrary(db, q),
    db.from("courses").select("id, slug, title, summary, academies!inner(slug, name)").eq("status", "published").is("deleted_at", null)
      .ilike("title", `%${q}%`).limit(12).then((r) => (r.data ?? []).flatMap((c) => { const a = [c.academies].flat()[0]; return a ? [{ ...c, academy: a }] : []; })),
  ]);
  const { subjects, books } = lib;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <PageHeader title={q ? `Results for “${q}”` : "Search"} eyebrow="Library and courses" />
      <form action={href(locale, "/search")} role="search" className="mt-5 flex max-w-xl gap-2">
        <input name="q" defaultValue={q} className="field flex-1" placeholder="Book, subject, author or course" aria-label="Search" />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      {q.length < 2 ? <div className="mt-8"><EmptyState title="Type at least two letters to search." /></div>
        : books.length === 0 && courses.length === 0 && subjects.length === 0 ? <div className="mt-8"><EmptyState title="Nothing found.">Try a shorter word, or browse the library by darja.</EmptyState></div>
        : (
          <>
            {subjects.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">Subjects</h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {subjects.map((s) => (
                    <SubjectCard key={s.id} href={href(locale, `/library/${s.boardSlug}/${s.levelSlug}/${s.slug}`)}
                      nameNative={s.name_ar ?? s.name_ur} nativeLang={s.name_ar ? "ar" : "ur"} nameLatin={s.name_en}
                      subtitle={`${splitLevelName(s.levelName).latin} · Open books`} />
                  ))}
                </ul>
              </section>
            )}
            {courses.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">Courses</h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {courses.map((c) => <CourseCard key={c.id} href={href(locale, `/courses/${c.academy.slug}/${c.slug}`)} premium={courseIsPremium(c)} title={c.title} byline={c.academy.name} meta={c.summary ?? undefined} />)}
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
