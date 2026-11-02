"use server";
import { requireUser } from "@/lib/auth/session";
import { academyErrorMessage, academyProfileSchema, registerAcademySchema } from "@/modules/academies/schemas";
import { idSchema } from "@/modules/catalog/schemas";
import { NOT_FOUND_OR_DENIED } from "@/modules/catalog/errors";
import { finish, localeOf, raw } from "./admin/action-utils";

// Registration goes through register_academy() (validates, caps, audits, makes the caller owner). Profile edits are plain
// updates: RLS lets only that academy's staff write, and a trigger blocks status/owner/slug changes.

export async function registerAcademy(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const parsed = registerAcademySchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, "/academy/register", "error", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const { data, error } = await supabase.rpc("register_academy", { p_name: parsed.data.name, p_slug: parsed.data.slug });
  if (error || !data) return finish(l, "/academy/register", "error", academyErrorMessage(error));
  const { data: row } = await supabase.from("academies").select("slug").eq("id", data).maybeSingle();
  return finish(l, row ? `/academy/${row.slug}` : "/academy", "notice", "Thank you. Your academy is waiting for review. We will update its status here.");
}

export async function updateAcademyProfile(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const { data: current } = await supabase.from("academies").select("slug").eq("id", id.data).maybeSingle();
  if (!current) return finish(l, "/academy", "error", NOT_FOUND_OR_DENIED);
  const back = `/academy/${current.slug}`;
  const parsed = academyProfileSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, back, "error", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const { data, error } = await supabase.from("academies").update(parsed.data).eq("id", id.data).select("id");
  if (error) return finish(l, back, "error", academyErrorMessage(error));
  if (!data?.length) return finish(l, back, "error", NOT_FOUND_OR_DENIED);
  return finish(l, back, "notice", "Saved.");
}
