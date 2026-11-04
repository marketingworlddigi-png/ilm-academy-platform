import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { Button, Card, EmptyState, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My learning", robots: { index: false, follow: false } };

type Prog = { total_lessons: number; completed_lessons: number; percent: number };

export default async function LearnPage({ params }: PageProps<"/[locale]/learn">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireUser(locale);

  const [{ data: enrolls }, { data: last }] = await Promise.all([
    supabase.from("enrollments").select("course_id, courses!inner(id, slug, title, academies!inner(slug, name))").eq("user_id", user.id).eq("status", "active"),
    supabase.from("lesson_progress").select("lesson_id, course_id, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1),
  ]);

  const mine = await Promise.all((enrolls ?? []).flatMap((e) => {
    const c = [e.courses].flat()[0]; const a = c && [c.academies].flat()[0];
    return c && a ? [{ id: c.id as string, title: c.title as string, academy: a.name as string, base: `/courses/${a.slug}/${c.slug}` }] : [];
  }).map(async (c) => {
    const { data } = await supabase.rpc("course_progress", { p_course: c.id });
    const r = (data as Prog[] | null)?.[0];
    return { ...c, percent: r?.percent ?? 0, done: r?.completed_lessons ?? 0, total: r?.total_lessons ?? 0 };
  }));

  const lastRow = last?.[0];
  const resume = lastRow ? mine.find((c) => c.id === lastRow.course_id) : undefined;
  const { data: lessonRow } = resume && lastRow ? await supabase.from("lessons").select("title").eq("id", lastRow.lesson_id).maybeSingle() : { data: null };

  return (
    <main>
      <section className="bg-ink text-white star-pattern">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-widest text-gold">Learn</p>
          <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-4xl">Continue learning</h1>
          <p className="mt-2 text-white/75">Pick up where you left off.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-10">
        {resume && lastRow && (
          <Card className="flex flex-wrap items-center justify-between gap-4 border-primary p-5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Resume</p>
              <p className="mt-1 text-lg font-bold">{lessonRow?.title ?? resume.title}</p>
              <p className="text-sm text-muted">{resume.title} &middot; {resume.academy}</p>
              <ProgressBar value={resume.percent} className="mt-3 w-64 max-w-full" label="Course progress" />
            </div>
            <Button href={href(locale, `${resume.base}/lessons/${lastRow.lesson_id}`)}>Resume lesson</Button>
          </Card>
        )}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-bold">My courses</h2>
            <Link href={href(locale, "/account")} className="text-sm font-semibold text-primary hover:underline">Account &rarr;</Link>
          </div>
          {mine.length === 0 ? (
            <div className="mt-4"><EmptyState title="You are not enrolled in any course yet." action={<Button href={href(locale, "/courses")}>Browse courses</Button>}>Enroll for free and your lessons show up here.</EmptyState></div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((c) => (
                <Card as="li" key={c.id} className="p-5">
                  <Link href={href(locale, c.base)} className="font-semibold leading-snug text-ink hover:text-primary">{c.title}</Link>
                  <p className="text-sm text-muted">{c.academy}</p>
                  <ProgressBar value={c.percent} className="mt-4" label={`${c.title} progress`} />
                  <p className="mt-1 text-xs text-muted">{c.done} of {c.total} lessons &middot; {c.percent}%</p>
                </Card>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
