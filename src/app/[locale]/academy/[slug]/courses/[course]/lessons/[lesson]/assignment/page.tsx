import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { deleteAssignment, gradeSubmission, saveAssignment } from "../../../../../../../assignment-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lesson assignment", robots: { index: false, follow: false } };

type Sub = { id: string; author: string; body: string; submitted_at: string; score: number | null; feedback: string | null; graded_at: string | null };

export default async function LessonAssignmentEditor({ params, searchParams }: PageProps<"/[locale]/academy/[slug]/courses/[course]/lessons/[lesson]/assignment">) {
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

  const { data: a } = await supabase.from("assignments").select("id, title, instructions, max_points").eq("lesson_id", l.id).maybeSingle();
  const subs = a ? (((await supabase.rpc("list_submissions", { p_assignment: a.id })).data ?? []) as Sub[]) : [];
  const hidden = (<><input type="hidden" name="locale" value={locale} /><input type="hidden" name="lesson_id" value={l.id} /></>);
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, `/academy/${academy.slug}/courses/${c.slug}`)}>Back to {c.title}</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Assignment: {l.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">Learners hand in short written work. You mark it with a score and feedback. Marked work cannot be changed by the learner.</p>
      <Flash error={error} notice={notice} />

      <Card title={a ? "Assignment" : "Create an assignment for this lesson"} className="mt-6">
        <form action={saveAssignment} className="space-y-3">
          {hidden}
          <div><label className="label" htmlFor="at">Title</label><input className="field" id="at" name="title" required minLength={2} maxLength={160} defaultValue={a?.title ?? `${l.title}: practice task`} /></div>
          <div><label className="label" htmlFor="ai">Instructions</label><textarea className="field min-h-32" id="ai" name="instructions" required minLength={2} maxLength={4000} defaultValue={a?.instructions ?? ""} /></div>
          <div className="max-w-40"><label className="label" htmlFor="ap">Total points</label><input className="field" id="ap" name="max_points" type="number" min={1} max={1000} required defaultValue={a?.max_points ?? 100} /></div>
          <button className="btn btn-primary" type="submit">{a ? "Save" : "Create assignment"}</button>
        </form>
        {a && <form action={deleteAssignment} className="mt-3">{hidden}<button className="btn btn-ghost text-sm" type="submit">Delete assignment and all submissions</button></form>}
      </Card>

      {a && (
        <>
          <h2 className="mt-10 font-display text-2xl font-semibold">Submissions ({subs.length})</h2>
          {subs.length === 0 && <p className="mt-2 text-sm text-ink-soft">Nothing handed in yet.</p>}
          <ul className="mt-4 space-y-4">
            {subs.map((s) => (
              <li key={s.id} className="rounded-xl border border-line p-4">
                <p className="text-sm text-ink-soft"><strong className="text-ink">{s.author}</strong> · handed in {fmt(s.submitted_at)}{s.graded_at && ` · marked ${s.score} / ${a.max_points}`}</p>
                <p className="mt-2 whitespace-pre-line">{s.body}</p>
                <form action={gradeSubmission} className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
                  {hidden}<input type="hidden" name="submission_id" value={s.id} />
                  <div><label className="label" htmlFor={`sc-${s.id}`}>Score (of {a.max_points})</label><input className="field" id={`sc-${s.id}`} name="score" type="number" min={0} max={a.max_points} required defaultValue={s.score ?? ""} /></div>
                  <div><label className="label" htmlFor={`fb-${s.id}`}>Feedback</label><input className="field" id={`fb-${s.id}`} name="feedback" maxLength={2000} defaultValue={s.feedback ?? ""} /></div>
                  <button className="btn btn-primary" type="submit">{s.graded_at ? "Update mark" : "Mark"}</button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
