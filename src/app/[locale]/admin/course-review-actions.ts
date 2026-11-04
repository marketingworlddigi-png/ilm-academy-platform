"use server";
import { requireSuperAdmin } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { NOT_FOUND_OR_DENIED } from "@/modules/catalog/errors";
import { courseErrorMessage, reviewDecisionSchema } from "@/modules/courses/schemas";
import { finish, localeOf, raw } from "./action-utils";

// The decision, the audit row and the permission check all live in review_course(); this only validates input.
export async function reviewCourse(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/admin/courses", "error", NOT_FOUND_OR_DENIED);
  const parsed = reviewDecisionSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, "/admin/courses", "error", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const { error } = await supabase.rpc("review_course", { p_course: id.data, p_decision: parsed.data.decision, p_note: parsed.data.note });
  if (error) return finish(l, "/admin/courses", "error", courseErrorMessage(error));
  return finish(l, "/admin/courses", "notice", parsed.data.decision === "approve" ? "Approved and published." : "Sent back to the academy with your note.");
}
