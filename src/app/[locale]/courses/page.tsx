import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]/courses">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "Courses from approved academies",
    description: "Browse courses published by approved academies. Create a free account to enroll and open every lesson.",
    alternates: alternatesFor(locale, "/courses"),
  };
}

export default async function CoursesPage({ params }: PageProps<"/[locale]/courses">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // Anonymous client: RLS returns only published courses of active academies.
  const { data } = await createPublicClient()
    .from("courses").select("id, slug, title, summary, academies!inner(slug, name)")
    .eq("status", "published").is("deleted_at", null).order("published_at", { ascending: false }).limit(60);
  const courses = (data ?? []).flatMap((c) => { const a = [c.academies].flat()[0]; return a ? [{ ...c, academy: a }] : []; });

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <Breadcrumbs crumbs={[{ label: "Home", path: href(locale) }, { label: "Courses", path: href(locale, "/courses") }]} />
      <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">Courses</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">Courses are run by approved academies. Anyone can read the outline; create a free account to enroll and open every lesson.</p>
      {courses.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line p-6 text-ink-soft">No courses are published yet. Meanwhile, the <Link className="text-brand underline" href={href(locale, "/library")}>library</Link> is open.</p>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id} className="rounded-2xl border border-line p-5">
              <h2 className="font-display text-xl font-semibold"><Link className="hover:underline" href={href(locale, `/courses/${c.academy.slug}/${c.slug}`)}>{c.title}</Link></h2>
              <p className="mt-1 text-sm text-ink-soft">{c.academy.name}</p>
              {c.summary && <p className="mt-3 text-sm">{c.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
