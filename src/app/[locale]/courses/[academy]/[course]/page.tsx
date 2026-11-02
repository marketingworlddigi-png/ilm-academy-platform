import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { getSessionUser } from "@/lib/auth/session";
import { createPublicClient } from "@/lib/supabase/public";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Flash, flashFrom } from "@/components/admin/ui";
import { enrollInCourse, leaveCourse } from "../../../course-actions";

type OutlineRow = { lesson_id: string; module_id: string; title: string; is_preview: boolean };

// Dynamic because the enrollment button depends on who is signed in.
export const dynamic = "force-dynamic";

async function loadCourse(academy: string, course: string) {
  const { data } = await createPublicClient()
    .from("courses").select("id, slug, title, summary, description, academies!inner(slug, name)")
    .eq("slug", course).eq("academies.slug", academy).eq("status", "published").is("deleted_at", null).maybeSingle();
  const a = data && [data.academies].flat()[0];
  return data && a ? { ...data, academy: a } : null;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/courses/[academy]/[course]">): Promise<Metadata> {
  const { locale, academy, course } = await params;
  if (!isLocale(locale)) return {};
  const c = await loadCourse(academy, course);
  if (!c) return { robots: { index: false } };
  return { title: `${c.title} by ${c.academy.name}`, description: c.summary ?? undefined, alternates: alternatesFor(locale, `/courses/${academy}/${course}`) };
}

export default async function CoursePage({ params, searchParams }: PageProps<"/[locale]/courses/[academy]/[course]">) {
  const { locale, academy, course } = await params;
  if (!isLocale(locale)) notFound();
  const c = await loadCourse(academy, course);
  if (!c) notFound();
  const { error, notice } = flashFrom(await searchParams);

  const { supabase, user } = await getSessionUser();
  const [{ data: outline }, { data: modules }, { data: enrollment }] = await Promise.all([
    supabase.rpc("course_outline", { p_course: c.id }),
    supabase.from("course_modules").select("id, title, position").eq("course_id", c.id).order("position"),
    user ? supabase.from("enrollments").select("status").eq("course_id", c.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const enrolled = enrollment?.status === "active";
  const lessonsOf = (moduleId: string) => ((outline ?? []) as OutlineRow[]).filter((l) => l.module_id === moduleId);
  const here = href(locale, `/courses/${c.academy.slug}/${c.slug}`);
  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} /><input type="hidden" name="course_id" value={c.id} />
      <input type="hidden" name="academy" value={c.academy.slug} /><input type="hidden" name="course" value={c.slug} />
    </>
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Breadcrumbs crumbs={[{ label: "Home", path: href(locale) }, { label: "Courses", path: href(locale, "/courses") }, { label: c.title, path: here }]} />
      <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{c.title}</h1>
      <p className="mt-1 text-ink-soft">By {c.academy.name}</p>
      <Flash error={error} notice={notice} />
      {c.summary && <p className="mt-4 text-lg">{c.summary}</p>}
      {c.description && <p className="mt-4 whitespace-pre-line text-ink-soft">{c.description}</p>}

      <div className="mt-6">
        {enrolled ? (
          <form action={leaveCourse} className="flex flex-wrap items-center gap-3">
            {hidden}
            <p className="text-sm font-semibold">You are enrolled.</p>
            <button className="btn btn-ghost" type="submit">Leave course</button>
          </form>
        ) : user ? (
          <form action={enrollInCourse}>{hidden}<button className="btn btn-primary" type="submit">Enroll for free</button></form>
        ) : (
          <Link className="btn btn-primary" href={`${href(locale, "/login")}?next=${encodeURIComponent(here)}`}>Sign in to enroll</Link>
        )}
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold">Outline</h2>
      {(modules ?? []).length === 0 ? <p className="mt-3 text-ink-soft">The outline is not available yet.</p> : (
        <ol className="mt-4 space-y-6">
          {(modules ?? []).map((m) => (
            <li key={m.id}>
              <h3 className="font-semibold">{m.title}</h3>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line text-sm">
                {lessonsOf(m.id).map((l) => (
                  <li key={l.lesson_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    {enrolled || l.is_preview
                      ? <Link className="text-brand underline" href={href(locale, `/courses/${c.academy.slug}/${c.slug}/lessons/${l.lesson_id}`)}>{l.title}</Link>
                      : <span>{l.title}</span>}
                    {l.is_preview && !enrolled && <span className="text-xs text-ink-soft">Free preview</span>}
                  </li>
                ))}
                {lessonsOf(m.id).length === 0 && <li className="px-4 py-3 text-ink-soft">No lessons yet.</li>}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
