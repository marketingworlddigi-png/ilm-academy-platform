import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { addQuestion, deleteQuestion, deleteQuiz, saveQuiz } from "../../../../../../../quiz-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lesson quiz", robots: { index: false, follow: false } };

export default async function LessonQuizEditor({ params, searchParams }: PageProps<"/[locale]/academy/[slug]/courses/[course]/lessons/[lesson]/quiz">) {
  const { locale, slug, course, lesson } = await params;
  if (!isLocale(locale)) notFound();
  const lid = idSchema.safeParse(lesson);
  if (!lid.success) notFound();
  const { supabase, user } = await requireUser(locale);
  const { error, notice } = flashFrom(await searchParams);

  const { data: academy } = await supabase.from("academies").select("id, slug").eq("slug", slug).is("deleted_at", null).maybeSingle();
  if (!academy) notFound();
  const { data: mine } = await supabase.from("memberships").select("role").eq("academy_id", academy.id).eq("user_id", user.id).eq("status", "active").in("role", ["academy_owner", "academy_admin", "instructor"]);
  if (!mine?.length) notFound();
  const { data: l } = await supabase.from("lessons").select("id, title, courses!inner(id, slug, title, academy_id)").eq("id", lid.data).maybeSingle();
  const c = l && [l.courses].flat()[0];
  if (!l || !c || c.slug !== course || c.academy_id !== academy.id) notFound();

  const { data: quiz } = await supabase.from("quizzes").select("id, title, pass_percent").eq("lesson_id", l.id).maybeSingle();
  const { data: questions } = quiz
    ? await supabase.from("quiz_questions").select("id, prompt, explanation, position, quiz_options(id, label, is_correct, position)").eq("quiz_id", quiz.id).order("position")
    : { data: [] };
  const hidden = (<><input type="hidden" name="locale" value={locale} /><input type="hidden" name="lesson_id" value={l.id} /></>);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, `/academy/${academy.slug}/courses/${c.slug}`)}>Back to {c.title}</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Quiz: {l.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">Single-choice questions, marked automatically. Learners see the right answers only after they submit.</p>
      <Flash error={error} notice={notice} />

      <Card title={quiz ? "Quiz settings" : "Create a quiz for this lesson"} className="mt-6">
        <form action={saveQuiz} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
          {hidden}
          <div><label className="label" htmlFor="qt">Title</label><input className="field" id="qt" name="title" required minLength={2} maxLength={160} defaultValue={quiz?.title ?? `${l.title}: check your understanding`} /></div>
          <div><label className="label" htmlFor="qp">Pass mark (%)</label><input className="field" id="qp" name="pass_percent" type="number" min={1} max={100} required defaultValue={quiz?.pass_percent ?? 70} /></div>
          <button className="btn btn-primary" type="submit">{quiz ? "Save" : "Create quiz"}</button>
        </form>
        {quiz && <form action={deleteQuiz} className="mt-3">{hidden}<button className="btn btn-ghost text-sm" type="submit">Delete quiz and all its questions</button></form>}
      </Card>

      {quiz && (
        <>
          <h2 className="mt-10 font-display text-2xl font-semibold">Questions ({(questions ?? []).length})</h2>
          {(questions ?? []).length === 0 && <p className="mt-2 text-sm text-ink-soft">No questions yet. Learners will not see this quiz until you add one.</p>}
          <ol className="mt-4 space-y-4">
            {(questions ?? []).map((q) => (
              <li key={q.id} className="rounded-xl border border-line p-4">
                <p className="font-semibold">{q.prompt}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {[...(q.quiz_options ?? [])].sort((a, b) => a.position - b.position).map((o) => (
                    <li key={o.id} className={o.is_correct ? "font-semibold text-brand" : ""}>{o.is_correct ? "✓ " : "• "}{o.label}{o.is_correct ? " (correct)" : ""}</li>
                  ))}
                </ul>
                {q.explanation && <p className="mt-2 text-sm text-ink-soft">Explanation: {q.explanation}</p>}
                <form action={deleteQuestion} className="mt-2">{hidden}<input type="hidden" name="question_id" value={q.id} /><button className="btn btn-ghost text-sm" type="submit">Remove question</button></form>
              </li>
            ))}
          </ol>

          <Card title="Add a question" className="mt-8">
            <form action={addQuestion} className="space-y-3">
              {hidden}
              <div><label className="label" htmlFor="qq">Question</label><textarea className="field min-h-20" id="qq" name="prompt" required minLength={2} maxLength={500} /></div>
              <fieldset>
                <legend className="label">Answers (fill at least two, pick the correct one)</legend>
                <div className="mt-1 space-y-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <input type="radio" name="correct" value={i} defaultChecked={i === 1} aria-label={`Answer ${i} is correct`} />
                      <input className="field" name={`option_${i}`} maxLength={200} aria-label={`Answer ${i}`} placeholder={i <= 2 ? `Answer ${i} (required)` : `Answer ${i} (optional)`} required={i <= 2} />
                    </div>
                  ))}
                </div>
              </fieldset>
              <div><label className="label" htmlFor="qe">Explanation shown after submitting (optional)</label><input className="field" id="qe" name="explanation" maxLength={500} /></div>
              <button className="btn btn-primary" type="submit">Add question</button>
            </form>
          </Card>
        </>
      )}
    </main>
  );
}
