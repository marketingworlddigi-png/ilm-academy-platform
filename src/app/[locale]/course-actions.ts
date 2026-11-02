"use server";
import { requireUser } from "@/lib/auth/session";
import { NOT_FOUND_OR_DENIED } from "@/modules/catalog/errors";
import { idSchema } from "@/modules/catalog/schemas";
import { courseErrorMessage, courseSchema, lessonSchema, moduleSchema, newCourseSchema } from "@/modules/courses/schemas";
import { finish, localeOf, raw } from "./admin/action-utils";

// Staff actions are plain table writes: RLS lets only the academy's owner/admin write and triggers enforce the rules.
// Redirect targets are rebuilt from the database, never taken from the form.

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function courseHome(supabase: Supa, courseId: string) {
  const { data } = await supabase.from("courses").select("slug, academies!inner(slug)").eq("id", courseId).maybeSingle();
  const a = data && [data.academies].flat()[0];
  return data && a ? { manage: `/academy/${a.slug}/courses/${data.slug}`, academy: a.slug, course: data.slug } : null;
}

const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Check the form and try again.";

export async function createCourse(fd: FormData) {
  const l = localeOf(fd);
  const { supabase, user } = await requireUser(l);
  const academyId = idSchema.safeParse(fd.get("academy_id"));
  const { data: academy } = academyId.success ? await supabase.from("academies").select("slug").eq("id", academyId.data).maybeSingle() : { data: null };
  if (!academyId.success || !academy) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const back = `/academy/${academy.slug}/courses`;
  const parsed = newCourseSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, back, "error", firstIssue(parsed.error));
  const { error } = await supabase.from("courses").insert({ ...parsed.data, academy_id: academyId.data, created_by: user.id });
  if (error) return finish(l, back, "error", courseErrorMessage(error));
  return finish(l, `${back}/${parsed.data.slug}`, "notice", "Course created as a draft. Add a module and a lesson, then publish it.");
}

async function withCourse(fd: FormData, field = "course_id") {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const id = idSchema.safeParse(fd.get(field));
  const home = id.success ? await courseHome(supabase, id.data) : null;
  return { l, supabase, id: id.success ? id.data : null, home };
}

export async function updateCourse(fd: FormData) {
  const { l, supabase, id, home } = await withCourse(fd, "id");
  if (!id || !home) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const parsed = courseSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, home.manage, "error", firstIssue(parsed.error));
  const { data, error } = await supabase.from("courses").update(parsed.data).eq("id", id).select("id");
  if (error) return finish(l, home.manage, "error", courseErrorMessage(error));
  if (!data?.length) return finish(l, home.manage, "error", NOT_FOUND_OR_DENIED);
  // The slug may have changed, so go to the new address.
  return finish(l, `/academy/${home.academy}/courses/${parsed.data.slug}`, "notice", "Saved.");
}

export async function setCourseStatus(fd: FormData) {
  const { l, supabase, id, home } = await withCourse(fd, "id");
  if (!id || !home) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const status = String(fd.get("status"));
  if (status !== "draft" && status !== "published" && status !== "archived") return finish(l, home.manage, "error", "Choose a status.");
  const { data, error } = await supabase.from("courses").update({ status }).eq("id", id).select("id");
  if (error) return finish(l, home.manage, "error", courseErrorMessage(error));
  if (!data?.length) return finish(l, home.manage, "error", NOT_FOUND_OR_DENIED);
  return finish(l, home.manage, "notice", status === "published" ? "Published. Students can now see it." : status === "draft" ? "Moved back to draft." : "Archived. It is hidden from students.");
}

export async function addModule(fd: FormData) {
  const { l, supabase, id, home } = await withCourse(fd);
  if (!id || !home) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const parsed = moduleSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, home.manage, "error", firstIssue(parsed.error));
  const { count } = await supabase.from("course_modules").select("id", { count: "exact", head: true }).eq("course_id", id);
  const { error } = await supabase.from("course_modules").insert({ course_id: id, title: parsed.data.title, position: (count ?? 0) + 1 });
  if (error) return finish(l, home.manage, "error", courseErrorMessage(error));
  return finish(l, home.manage, "notice", "Module added.");
}

export async function deleteModule(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const mid = idSchema.safeParse(fd.get("id"));
  const { data: m } = mid.success ? await supabase.from("course_modules").select("course_id").eq("id", mid.data).maybeSingle() : { data: null };
  const home = m ? await courseHome(supabase, m.course_id) : null;
  if (!mid.success || !home) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const { error } = await supabase.from("course_modules").delete().eq("id", mid.data);
  if (error) return finish(l, home.manage, "error", error.code === "23503" ? "Delete the lessons in this module first." : courseErrorMessage(error));
  return finish(l, home.manage, "notice", "Module removed.");
}

export async function addLesson(fd: FormData) {
  const { l, supabase, id, home } = await withCourse(fd);
  const moduleId = idSchema.safeParse(fd.get("module_id"));
  if (!id || !home || !moduleId.success) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const parsed = lessonSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, home.manage, "error", firstIssue(parsed.error));
  const { count } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", id);
  const { error } = await supabase.from("lessons").insert({ ...parsed.data, course_id: id, module_id: moduleId.data, position: (count ?? 0) + 1 });
  if (error) return finish(l, home.manage, "error", courseErrorMessage(error));
  return finish(l, home.manage, "notice", "Lesson added.");
}

export async function updateLesson(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const lid = idSchema.safeParse(fd.get("id"));
  const { data: row } = lid.success ? await supabase.from("lessons").select("course_id").eq("id", lid.data).maybeSingle() : { data: null };
  const home = row ? await courseHome(supabase, row.course_id) : null;
  if (!lid.success || !home) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const parsed = lessonSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, home.manage, "error", firstIssue(parsed.error));
  const position = Math.max(0, Math.min(9999, Math.trunc(Number(fd.get("position")) || 0)));
  const { data, error } = await supabase.from("lessons").update({ ...parsed.data, position }).eq("id", lid.data).select("id");
  if (error) return finish(l, home.manage, "error", courseErrorMessage(error));
  if (!data?.length) return finish(l, home.manage, "error", NOT_FOUND_OR_DENIED);
  return finish(l, home.manage, "notice", "Lesson saved.");
}

export async function deleteLesson(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const lid = idSchema.safeParse(fd.get("id"));
  const { data: row } = lid.success ? await supabase.from("lessons").select("course_id").eq("id", lid.data).maybeSingle() : { data: null };
  const home = row ? await courseHome(supabase, row.course_id) : null;
  if (!lid.success || !home) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const { error } = await supabase.from("lessons").delete().eq("id", lid.data);
  if (error) return finish(l, home.manage, "error", courseErrorMessage(error));
  return finish(l, home.manage, "notice", "Lesson removed.");
}

// ---- learners
const publicPath = (fd: FormData) => `/courses/${encodeURIComponent(String(fd.get("academy") ?? ""))}/${encodeURIComponent(String(fd.get("course") ?? ""))}`;

export async function enrollInCourse(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const id = idSchema.safeParse(fd.get("course_id"));
  if (!id.success) return finish(l, "/courses", "error", NOT_FOUND_OR_DENIED);
  const { error } = await supabase.rpc("enroll_in_course", { p_course: id.data });
  if (error) return finish(l, publicPath(fd), "error", courseErrorMessage(error));
  return finish(l, publicPath(fd), "notice", "You are enrolled. Every lesson is open to you now.");
}

export async function leaveCourse(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const id = idSchema.safeParse(fd.get("course_id"));
  if (!id.success) return finish(l, "/courses", "error", NOT_FOUND_OR_DENIED);
  const { error } = await supabase.rpc("leave_course", { p_course: id.data });
  if (error) return finish(l, publicPath(fd), "error", courseErrorMessage(error));
  return finish(l, publicPath(fd), "notice", "You left the course. You can enroll again any time.");
}
