"use server";
import { requireSuperAdmin } from "@/lib/auth/session";
import { academyErrorMessage, reviewAcademySchema } from "@/modules/academies/schemas";
import { idSchema } from "@/modules/catalog/schemas";
import { NOT_FOUND_OR_DENIED } from "@/modules/catalog/errors";
import { finish, localeOf, raw } from "./action-utils";

// The decision, the audit row and the permission check all live in review_academy(); this only validates input.
export async function reviewAcademy(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/admin/academies", "error", NOT_FOUND_OR_DENIED);
  const parsed = reviewAcademySchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, "/admin/academies", "error", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const { error } = await supabase.rpc("review_academy", { p_academy: id.data, p_status: parsed.data.status, p_note: parsed.data.note });
  if (error) return finish(l, "/admin/academies", "error", academyErrorMessage(error));
  return finish(l, "/admin/academies", "notice", "Academy updated.");
}
