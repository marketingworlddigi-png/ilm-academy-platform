import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { getSessionUser } from "@/lib/auth/session";
import { createPublicClient } from "@/lib/supabase/public";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
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

  const lessonCount = ((outline ?? []) as OutlineRow[]).length;
  const previewCount = ((outline ?? []) as OutlineRow[]).filter((l) => l.is_preview).length;
  const enrollBox = enrolled ? (
    <form action={leaveCourse} className="space-y-3">
      {hidden}
      <Badge tone="green">You are enrolled</Badge>
      <button className="btn btn-ghost w-full" type="submit">Leave course</button>
    </form>
  ) : user ? (
    <form action={enrollInCourse}>{hidden}<Button type="submit" className="w-full">Enroll for free</Button></form>
  ) : (
    <Button href={`${href(locale, "/login")}?next=${encodeURIComponent(here)}`} className="w-full">Sign in to enroll</Button>
  );

  return (
    <main>
      <section className="bg-ink text-white star-pattern">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <div><Breadcrumbs tone="dark" crumbs={[{ label: "Home", path: href(locale) }, { label: "Courses", path: href(locale, "/courses") }, { label: c.title, path: here }]} /></div>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">{c.title}</h1>
          <p className="mt-2 text-white/75">By {c.academy.name}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="gold">{lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}</Badge>
            {previewCount > 0 && <Badge tone="dark">{previewCount} free {previewCount === 1 ? "preview" : "previews"}</Badge>}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Flash error={error} notice={notice} />
          {c.summary && <p className="text-lg text-ink">{c.summary}</p>}
          {c.description && <p className="mt-4 whitespace-pre-line text-muted">{c.description}</p>}

          <h2 className="mt-10 text-2xl font-bold">Course outline</h2>
          {(modules ?? []).length === 0 ? <div className="mt-4"><EmptyState title="The outline is not available yet." /></div> : (
            <ol className="mt-4 space-y-5">
              {(modules ?? []).map((m, idx) => (
                <li key={m.id}>
                  <h3 className="flex items-center gap-3 font-semibold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-white">{idx + 1}</span>{m.title}
                  </h3>
                  <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-white text-sm">
                    {lessonsOf(m.id).map((l) => (
                      <li key={l.lesson_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                        {enrolled || l.is_preview
                          ? <Link className="font-medium text-primary hover:underline" href={href(locale, `/courses/${c.academy.slug}/${c.slug}/lessons/${l.lesson_id}`)}>{l.title}</Link>
                          : <span className="text-muted">{l.title}</span>}
                        {l.is_preview && !enrolled && <Badge tone="green">Free preview</Badge>}
                      </li>
                    ))}
                    {lessonsOf(m.id).length === 0 && <li className="px-4 py-3 text-muted">No lessons yet.</li>}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4 p-5">
            <p className="text-2xl font-bold">Free</p>
            {enrollBox}
            <p className="text-xs text-muted">Offered by {c.academy.name}. Sign in to save your progress.</p>
          </Card>
        </aside>
      </div>
    </main>
  );
}
