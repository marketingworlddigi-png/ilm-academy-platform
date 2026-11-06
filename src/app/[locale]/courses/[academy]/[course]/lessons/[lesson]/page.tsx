import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { getSessionUser } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";
import { Flash, flashFrom } from "@/components/admin/ui";
import { parseVideoUrl } from "@/modules/courses/video";
import { LessonTabs } from "@/components/lesson-tabs";
import { AssignmentPanel, type AssignmentData } from "@/components/assignment-panel";
import { NotesPanel } from "@/components/notes-panel";
import { QaPanel } from "@/components/qa-panel";
import { QuizPlayer, type LastAttempt } from "@/components/quiz-player";
import { completeLesson } from "../../../../../learn-actions";

export const dynamic = "force-dynamic";
// Members-only content: never indexed. The lesson text itself is returned by the database only to enrolled users (or for previews).
export const metadata: Metadata = { title: "Lesson", robots: { index: false, follow: false } };

type OutlineRow = { lesson_id: string; module_id: string; title: string; is_preview: boolean };

export default async function LessonPage({ params, searchParams }: PageProps<"/[locale]/courses/[academy]/[course]/lessons/[lesson]">) {
  const { locale, academy, course, lesson } = await params;
  if (!isLocale(locale)) notFound();
  const id = idSchema.safeParse(lesson);
  if (!id.success) notFound();
  const { error, notice } = flashFrom(await searchParams);

  const { supabase, user } = await getSessionUser();
  const { data: l } = await supabase.from("lessons")
    .select("id, title, body, is_preview, resource_id, video_url, position, module_id, courses!inner(id, slug, title, academies!inner(slug))")
    .eq("id", id.data).maybeSingle();
  const c = l && [l.courses].flat()[0];
  const a = c && [c.academies].flat()[0];
  if (!l || !c || !a || c.slug !== course || a.slug !== academy) notFound();

  const base = `/courses/${academy}/${course}`;
  const here = href(locale, `${base}/lessons/${l.id}`);
  const [{ data: outlineData }, { data: modules }, { data: book }, { data: enrollment }, { data: done }, { data: prog }] = await Promise.all([
    supabase.rpc("course_outline", { p_course: c.id }),
    supabase.from("course_modules").select("id, title, position").eq("course_id", c.id).order("position"),
    l.resource_id ? supabase.from("resources").select("id, title").eq("id", l.resource_id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("enrollments").select("status").eq("course_id", c.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id).eq("course_id", c.id).not("completed_at", "is", null) : Promise.resolve({ data: [] }),
    user ? supabase.rpc("course_progress", { p_course: c.id }) : Promise.resolve({ data: null }),
  ]);
  // The quiz comes through get_quiz(), which leaves out the answer key and returns null unless you can open this lesson.
  const quiz = user ? ((await supabase.rpc("get_quiz", { p_lesson: l.id })).data as { id: string; title: string; pass_percent: number; questions: { id: string; prompt: string; options: { id: string; label: string }[] }[] } | null) : null;
  const { data: lastRows } = quiz && user
    ? await supabase.from("quiz_attempts").select("score, total, percent, passed").eq("quiz_id", quiz.id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1)
    : { data: null };
  const assignment = user ? ((await supabase.rpc("get_assignment", { p_lesson: l.id })).data as AssignmentData | null) : null;
  const last = (lastRows?.[0] ?? null) as LastAttempt;
  const enrolled = enrollment?.status === "active";
  const outline = (outlineData ?? []) as OutlineRow[];
  const doneIds = new Set((done ?? []).map((d: { lesson_id: string }) => d.lesson_id));
  const idx = outline.findIndex((o) => o.lesson_id === l.id);
  const prev = idx > 0 ? outline[idx - 1] : undefined;
  const next = idx >= 0 ? outline[idx + 1] : undefined;
  const pr = (prog as { total_lessons: number; completed_lessons: number; percent: number }[] | null)?.[0];
  const isDone = doneIds.has(l.id);
  const video = parseVideoUrl(l.video_url);
  const lessonHref = (lid: string) => href(locale, `${base}/lessons/${lid}`);

  // Remember where the learner is, so "Continue learning" resumes here. Failure is harmless.
  if (user && enrolled) await supabase.rpc("record_lesson_position", { p_lesson: l.id, p_seconds: 0 });

  const sidebar = (
    <nav aria-label="Course outline" className="space-y-5">
      {(modules ?? []).map((m, mi) => (
        <div key={m.id}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{mi + 1}. {m.title}</h2>
          <ul className="mt-2 space-y-1">
            {outline.filter((o) => o.module_id === m.id).map((o) => {
              const open = enrolled || o.is_preview;
              const current = o.lesson_id === l.id;
              const cls = `flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm ${current ? "bg-primary text-white" : open ? "text-ink hover:bg-surface" : "text-muted"}`;
              const mark = <span aria-hidden="true" className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${doneIds.has(o.lesson_id) ? "border-gold bg-gold text-ink" : current ? "border-white" : "border-line"}`}>{doneIds.has(o.lesson_id) ? "✓" : ""}</span>;
              return (
                <li key={o.lesson_id}>
                  {open
                    ? <Link href={lessonHref(o.lesson_id)} aria-current={current ? "page" : undefined} className={cls}>{mark}<span className="min-w-0">{o.title}</span></Link>
                    : <span className={cls}>{mark}<span className="min-w-0">{o.title}</span></span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <main>
      <section className="bg-ink text-white star-pattern">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
          <Breadcrumbs tone="dark" crumbs={[{ label: "Home", path: href(locale) }, { label: c.title, path: href(locale, base) }, { label: l.title, path: here }]} />
          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{l.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {l.is_preview && <Badge tone="gold">Free preview</Badge>}
            {isDone && <Badge tone="green">Completed</Badge>}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[1fr_300px]">
        <article className="min-w-0">
          <Flash error={error} notice={notice} />
          {video && (
            <div className="mb-6 aspect-video w-full overflow-hidden rounded-[14px] border border-line bg-ink">
              {/* The address is rebuilt from the parsed video id (YouTube via youtube-nocookie.com), never the pasted text. */}
              <iframe src={video.embedUrl} title={`Video: ${l.title}`} loading="lazy" className="h-full w-full"
                allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
            </div>
          )}
          <LessonTabs tabs={[
            { id: "lesson", label: "Lesson", panel: (<>
            {/* Plain text only, never HTML. */}
          {l.body ? <div className="whitespace-pre-line text-lg leading-relaxed">{l.body}</div> : <p className="text-muted">This lesson has no text.</p>}
            </>) },
            ...(book ? [{ id: "book", label: "Book", panel: (
              <Card className="p-4 text-sm">
                Reading for this lesson: <Link className="font-semibold text-primary hover:underline" href={href(locale, `/books/${book.id}`)}>{book.title}</Link>
              </Card>) }] : []),
            ...(quiz ? [{ id: "quiz", label: "Quiz", panel: <QuizPlayer quiz={quiz} last={last} /> }] : []),
            ...(assignment ? [{ id: "assignment", label: "Assignment", panel: <AssignmentPanel assignment={assignment} /> }] : []),
            ...(user ? [{ id: "notes", label: "Notes", panel: <NotesPanel lessonId={l.id} userId={user.id} /> }] : []),
            ...(user ? [{ id: "questions", label: "Questions", panel: <QaPanel lessonId={l.id} /> }] : []),
          ]} />
          {!user && (
            <p className="mt-8 text-sm text-muted"><Link className="font-semibold text-primary underline" href={`${href(locale, "/login")}?next=${encodeURIComponent(here)}`}>Sign in</Link> and enroll to open every lesson and save your progress.</p>
          )}
          {user && !enrolled && (
            <p className="mt-8 text-sm text-muted"><Link className="font-semibold text-primary underline" href={href(locale, base)}>Enroll in this course</Link> to save your progress.</p>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            {prev ? <Button href={lessonHref(prev.lesson_id)} variant="outline">&larr; Previous</Button> : <span />}
            <div className="flex flex-wrap gap-3">
              {user && enrolled && (
                <form action={completeLesson}>
                  <input type="hidden" name="locale" value={locale} /><input type="hidden" name="lesson_id" value={l.id} />
                  <Button type="submit">{next ? (isDone ? "Next lesson" : "Mark complete & continue") : isDone ? "Back to course" : "Mark complete & finish"}</Button>
                </form>
              )}
              {!(user && enrolled) && next && <Button href={lessonHref(next.lesson_id)}>Next &rarr;</Button>}
            </div>
          </div>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-4">
            {pr && (
              <div className="mb-5">
                <p className="text-sm font-semibold">{pr.completed_lessons} of {pr.total_lessons} lessons &middot; {pr.percent}%</p>
                <ProgressBar value={pr.percent} className="mt-2" label="Course progress" />
              </div>
            )}
            {sidebar}
          </Card>
        </aside>
      </div>
    </main>
  );
}
