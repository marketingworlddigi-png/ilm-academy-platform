"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { href } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { localeOf } from "./admin/action-utils";

// Marks a lesson complete via the database function (which checks enrollment/preview access) and moves to the next lesson.
// The redirect target is rebuilt from the database, never taken from the form.
export async function completeLesson(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const id = idSchema.safeParse(fd.get("lesson_id"));
  if (!id.success) return redirect(href(l, "/learn"));
  const { data: next, error } = await supabase.rpc("complete_lesson", { p_lesson: id.data });
  const { data: row } = await supabase.from("lessons").select("id, courses!inner(slug, academies!inner(slug))").eq("id", id.data).maybeSingle();
  const c = row && [row.courses].flat()[0];
  const a = c && [c.academies].flat()[0];
  if (!c || !a) return redirect(href(l, "/learn"));
  const base = `/courses/${a.slug}/${c.slug}`;
  revalidatePath(href(l, "/learn"));
  if (error) return redirect(`${href(l, `${base}/lessons/${id.data}`)}?error=${encodeURIComponent("You need to enroll in this course to save progress.")}`);
  return redirect(typeof next === "string" ? href(l, `${base}/lessons/${next}`) : `${href(l, base)}?notice=${encodeURIComponent("Course finished. Well done.")}`);
}
