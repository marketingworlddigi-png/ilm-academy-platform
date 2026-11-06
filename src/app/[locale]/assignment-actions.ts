"use server";
import { requireUser } from "@/lib/auth/session";
import { NOT_FOUND_OR_DENIED } from "@/modules/catalog/errors";
import { idSchema } from "@/modules/catalog/schemas";
import { finish, localeOf } from "./admin/action-utils";

// Teacher actions. The assignment is a plain table write (row-level security limits it to the academy's teachers);
// marking goes through grade_submission(). Redirect targets are rebuilt from the database, never taken from the form.

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function lessonHome(supabase: Supa, lessonId: string) {
  const { data } = await supabase.from("lessons").select("id, courses!inner(slug, academies!inner(slug))").eq("id", lessonId).maybeSingle();
  const c = data && [data.courses].flat()[0];
  const a = c && [c.academies].flat()[0];
  return data && c && a ? { lesson: data.id, path: `/academy/${a.slug}/courses/${c.slug}/lessons/${data.id}/assignment` } : null;
}

async function context(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const lid = idSchema.safeParse(fd.get("lesson_id"));
  const home = lid.success ? await lessonHome(supabase, lid.data) : null;
  if (!home) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  return { l, supabase, home };
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function saveAssignment(fd: FormData) {
  const { l, supabase, home } = await context(fd);
  const title = text(fd, "title"), instructions = text(fd, "instructions"), points = Number(fd.get("max_points"));
  if (title.length < 2 || title.length > 160) return finish(l, home.path, "error", "Give the assignment a title (2 to 160 characters).");
  if (instructions.length < 2 || instructions.length > 4000) return finish(l, home.path, "error", "Write the instructions (up to 4000 characters).");
  if (!Number.isInteger(points) || points < 1 || points > 1000) return finish(l, home.path, "error", "Total points must be a whole number from 1 to 1000.");
  const values = { title, instructions, max_points: points };
  const { data: existing } = await supabase.from("assignments").select("id").eq("lesson_id", home.lesson).maybeSingle();
  const { error } = existing
    ? await supabase.from("assignments").update(values).eq("id", existing.id)
    : await supabase.from("assignments").insert({ ...values, lesson_id: home.lesson });
  if (error) return finish(l, home.path, "error", NOT_FOUND_OR_DENIED);
  return finish(l, home.path, "notice", existing ? "Assignment saved." : "Assignment created.");
}

export async function deleteAssignment(fd: FormData) {
  const { l, supabase, home } = await context(fd);
  const { error } = await supabase.from("assignments").delete().eq("lesson_id", home.lesson);
  if (error) return finish(l, home.path, "error", NOT_FOUND_OR_DENIED);
  return finish(l, home.path, "notice", "Assignment deleted along with its submissions.");
}

export async function gradeSubmission(fd: FormData) {
  const { l, supabase, home } = await context(fd);
  const sid = idSchema.safeParse(fd.get("submission_id"));
  const raw = String(fd.get("score") ?? "").trim();
  const score = raw === "" ? NaN : Number(raw);
  if (!sid.success || !Number.isInteger(score)) return finish(l, home.path, "error", "Enter a whole-number score.");
  const { error } = await supabase.rpc("grade_submission", { p_submission: sid.data, p_score: score, p_feedback: text(fd, "feedback") });
  if (error) return finish(l, home.path, "error", ["22023", "P0002"].includes(error.code) ? error.message : NOT_FOUND_OR_DENIED);
  return finish(l, home.path, "notice", "Marked.");
}
