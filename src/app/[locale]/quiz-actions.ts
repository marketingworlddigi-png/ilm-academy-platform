"use server";
import { requireUser } from "@/lib/auth/session";
import { NOT_FOUND_OR_DENIED } from "@/modules/catalog/errors";
import { idSchema } from "@/modules/catalog/schemas";
import { questionFromForm, quizErrorMessage, quizSettingsSchema } from "@/modules/courses/quiz";
import { finish, localeOf, raw } from "./admin/action-utils";

// Teacher actions are plain table writes: RLS lets only the academy's owner, admins and teachers write, and the
// answer key is never readable by learners. Redirect targets are rebuilt from the database, never taken from the form.

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function lessonHome(supabase: Supa, lessonId: string) {
  const { data } = await supabase.from("lessons").select("id, courses!inner(slug, academies!inner(slug))").eq("id", lessonId).maybeSingle();
  const c = data && [data.courses].flat()[0];
  const a = c && [c.academies].flat()[0];
  return data && c && a ? { lesson: data.id, path: `/academy/${a.slug}/courses/${c.slug}/lessons/${data.id}/quiz` } : null;
}

async function context(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const lid = idSchema.safeParse(fd.get("lesson_id"));
  const home = lid.success ? await lessonHome(supabase, lid.data) : null;
  if (!home) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  return { l, supabase, home };
}

export async function saveQuiz(fd: FormData) {
  const { l, supabase, home } = await context(fd);
  const parsed = quizSettingsSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, home.path, "error", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const { data: existing } = await supabase.from("quizzes").select("id").eq("lesson_id", home.lesson).maybeSingle();
  const { error } = existing
    ? await supabase.from("quizzes").update(parsed.data).eq("id", existing.id)
    : await supabase.from("quizzes").insert({ ...parsed.data, lesson_id: home.lesson });
  if (error) return finish(l, home.path, "error", quizErrorMessage(error));
  return finish(l, home.path, "notice", existing ? "Quiz saved." : "Quiz created. Add your first question below.");
}

export async function deleteQuiz(fd: FormData) {
  const { l, supabase, home } = await context(fd);
  const { error } = await supabase.from("quizzes").delete().eq("lesson_id", home.lesson);
  if (error) return finish(l, home.path, "error", quizErrorMessage(error));
  return finish(l, home.path, "notice", "Quiz deleted.");
}

export async function addQuestion(fd: FormData) {
  const { l, supabase, home } = await context(fd);
  const parsed = questionFromForm(fd);
  if (!parsed.success) return finish(l, home.path, "error", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const { data: quiz } = await supabase.from("quizzes").select("id").eq("lesson_id", home.lesson).maybeSingle();
  if (!quiz) return finish(l, home.path, "error", "Create the quiz first.");
  const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", quiz.id);
  const { data: q, error } = await supabase.from("quiz_questions")
    .insert({ quiz_id: quiz.id, prompt: parsed.data.prompt, explanation: parsed.data.explanation, position: (count ?? 0) + 1 }).select("id").single();
  if (error || !q) return finish(l, home.path, "error", quizErrorMessage(error));
  const { error: optError } = await supabase.from("quiz_options").insert(
    parsed.data.options.map((o, i) => ({ question_id: q.id, label: o.label, is_correct: o.index === parsed.data.correct, position: i + 1 })));
  if (optError) {
    await supabase.from("quiz_questions").delete().eq("id", q.id); // never leave a question without its answers
    return finish(l, home.path, "error", quizErrorMessage(optError));
  }
  return finish(l, home.path, "notice", "Question added.");
}

export async function deleteQuestion(fd: FormData) {
  const { l, supabase, home } = await context(fd);
  const qid = idSchema.safeParse(fd.get("question_id"));
  if (!qid.success) return finish(l, home.path, "error", NOT_FOUND_OR_DENIED);
  const { error } = await supabase.from("quiz_questions").delete().eq("id", qid.data);
  if (error) return finish(l, home.path, "error", quizErrorMessage(error));
  return finish(l, home.path, "notice", "Question removed.");
}
