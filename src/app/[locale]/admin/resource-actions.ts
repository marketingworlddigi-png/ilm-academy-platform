"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/session";
import { href } from "@/lib/i18n/config";
import { idSchema } from "@/modules/catalog/schemas";
import { catalogErrorMessage, NOT_FOUND_OR_DENIED } from "@/modules/catalog/errors";
import { copyrightSchema, expiryToTimestamp, resourceSchema } from "@/modules/library/schemas";
import { isExpectedObjectName, UPLOAD_RULES, type UploadKind } from "@/modules/library/uploads";
import { finish, localeOf, raw } from "./action-utils";

// Same model as catalog-actions: the user's own client, so row-level security and the database triggers
// (publish guard, copyright guard) are the authority. These actions add validation and readable messages.

const detail = (id: string) => `/admin/resources/${id}`;
const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Check the form and try again.";

export async function createResource(fd: FormData) {
  const l = localeOf(fd);
  const { supabase, user } = await requireSuperAdmin(l);
  const parsed = resourceSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, "/admin/resources", "error", firstIssue(parsed.error));
  const placement = await checkPlacement(supabase, parsed.data);
  if (placement.error) return finish(l, "/admin/resources", "error", placement.error);
  const { data, error } = await supabase.from("resources")
    .insert({ ...parsed.data, board_id: placement.board_id, academy_id: null, created_by: user.id, status: "draft" })
    .select("id").single();
  if (error || !data) return finish(l, "/admin/resources", "error", catalogErrorMessage(error, "resource"));
  return redirect(`${href(l, detail(data.id))}?notice=${encodeURIComponent("Resource created as a draft. Upload the file and complete the copyright record next.")}`);
}

export async function updateResource(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/admin/resources", "error", NOT_FOUND_OR_DENIED);
  const parsed = resourceSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, detail(id.data), "error", firstIssue(parsed.error));
  const placement = await checkPlacement(supabase, parsed.data);
  if (placement.error) return finish(l, detail(id.data), "error", placement.error);
  const { data, error } = await supabase.from("resources")
    .update({ ...parsed.data, board_id: placement.board_id }).eq("id", id.data).is("deleted_at", null).select("id");
  if (error) return finish(l, detail(id.data), "error", catalogErrorMessage(error, "resource"));
  if (!data?.length) return finish(l, detail(id.data), "error", NOT_FOUND_OR_DENIED);
  return finish(l, detail(id.data), "notice", "Resource saved.");
}

/** A level must exist, a subject must be offered at that level, and the board is always derived from the level. */
async function checkPlacement(supabase: Awaited<ReturnType<typeof createClient>>, v: { board_id: string | null; level_id: string | null; subject_id: string | null }) {
  if (!v.level_id) {
    if (v.subject_id) return { board_id: v.board_id, error: "Choose a level before choosing a subject." };
    return { board_id: v.board_id, error: null };
  }
  const { data: level } = await supabase.from("levels").select("board_id").eq("id", v.level_id).maybeSingle();
  if (!level) return { board_id: null, error: "That level no longer exists." };
  if (v.board_id && v.board_id !== level.board_id) return { board_id: null, error: "The chosen level does not belong to the chosen board." };
  if (v.subject_id) {
    const { data: link } = await supabase.from("level_subjects").select("subject_id")
      .eq("level_id", v.level_id).eq("subject_id", v.subject_id).maybeSingle();
    if (!link) return { board_id: null, error: "That subject is not offered at the chosen level. Link it on the level page first." };
  }
  return { board_id: level.board_id as string, error: null };
}

/** Called after the browser has uploaded straight to Storage: verify the object, then record its path. */
export async function attachUpload(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  const kind = String(fd.get("kind")) as UploadKind;
  const path = String(fd.get("path") ?? "");
  if (!id.success || !(kind in UPLOAD_RULES) || !isExpectedObjectName(kind, id.data, path)) {
    return finish(l, id.success ? detail(id.data) : "/admin/resources", "error", "That upload was not recognised.");
  }
  const rule = UPLOAD_RULES[kind];
  const slash = path.lastIndexOf("/");
  const { data: found, error: listError } = await supabase.storage.from(rule.bucket).list(path.slice(0, slash), { search: path.slice(slash + 1) });
  if (listError || !found?.some((o) => o.name === path.slice(slash + 1))) {
    return finish(l, detail(id.data), "error", "The file did not finish uploading. Please try again.");
  }
  const write = kind === "evidence"
    ? await supabase.from("copyright_permissions").update({ evidence_file_path: path }).eq("resource_id", id.data).select("resource_id")
    : await supabase.from("resources").update(kind === "main" ? { storage_path: path } : { cover_path: path }).eq("id", id.data).is("deleted_at", null).select("id");
  if (write.error) return finish(l, detail(id.data), "error", catalogErrorMessage(write.error, "file"));
  if (!write.data?.length) return finish(l, detail(id.data), "error", NOT_FOUND_OR_DENIED);
  const label = { main: "File", cover: "Cover", evidence: "Evidence file" }[kind];
  return finish(l, detail(id.data), "notice", `${label} uploaded.`);
}

export async function saveCopyright(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/admin/resources", "error", NOT_FOUND_OR_DENIED);
  const parsed = copyrightSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, detail(id.data), "error", firstIssue(parsed.error));
  const { expires_on, ...fields } = parsed.data;
  const expires_at = expiryToTimestamp(expires_on);
  if (fields.permission_status === "approved") {
    if (expires_at && new Date(expires_at) <= new Date()) return finish(l, detail(id.data), "error", "An approved record cannot already be expired. Choose a future expiry date or leave it empty.");
    const { data: current } = await supabase.from("copyright_permissions").select("evidence_file_path").eq("resource_id", id.data).maybeSingle();
    if (!fields.evidence_reference && !current?.evidence_file_path) {
      return finish(l, detail(id.data), "error", "Approval needs evidence: write a reference (letter, licence URL, public-domain source) or upload an evidence file first.");
    }
  }
  const { data, error } = await supabase.from("copyright_permissions")
    .update({ ...fields, expires_at }).eq("resource_id", id.data).select("resource_id");
  if (error) return finish(l, detail(id.data), "error", catalogErrorMessage(error, "copyright record"));
  if (!data?.length) return finish(l, detail(id.data), "error", NOT_FOUND_OR_DENIED);
  const note = fields.permission_status === "approved" && !fields.allow_commercial
    ? " Note: commercial use is not granted, so keep this resource on the free tier."
    : "";
  return finish(l, detail(id.data), "notice", `Copyright record saved.${note}`);
}

export async function publishResource(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/admin/resources", "error", NOT_FOUND_OR_DENIED);
  const { data: res } = await supabase.from("resources").select("storage_path").eq("id", id.data).is("deleted_at", null).maybeSingle();
  if (!res) return finish(l, detail(id.data), "error", NOT_FOUND_OR_DENIED);
  if (!res.storage_path) return finish(l, detail(id.data), "error", "Upload the main file before publishing.");
  const { data: ok } = await supabase.rpc("resource_permission_valid", { p_resource: id.data });
  if (!ok) return finish(l, detail(id.data), "error", "Cannot publish: the distribution permission must be Approved and not expired.");
  const { data, error } = await supabase.from("resources").update({ status: "published" }).eq("id", id.data).select("id");
  if (error) return finish(l, detail(id.data), "error", catalogErrorMessage(error, "resource"));
  if (!data?.length) return finish(l, detail(id.data), "error", NOT_FOUND_OR_DENIED);
  return finish(l, detail(id.data), "notice", "Published. It is now visible in the public library.");
}

export async function unpublishResource(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  const status = fd.get("status") === "archived" ? "archived" : "draft";
  if (!id.success) return finish(l, "/admin/resources", "error", NOT_FOUND_OR_DENIED);
  const { data, error } = await supabase.from("resources").update({ status }).eq("id", id.data).is("deleted_at", null).select("id");
  if (error) return finish(l, detail(id.data), "error", catalogErrorMessage(error, "resource"));
  if (!data?.length) return finish(l, detail(id.data), "error", NOT_FOUND_OR_DENIED);
  return finish(l, detail(id.data), "notice", status === "archived" ? "Archived. It is hidden from the public library." : "Moved back to draft. It is hidden from the public library.");
}

/** Soft delete: the row and its files stay for audit, but it disappears everywhere. */
export async function deleteResource(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success || fd.get("confirm") !== "on") return finish(l, "/admin/resources", "error", "Tick the confirmation box to delete.");
  // Through a function: a plain UPDATE setting deleted_at fails the SELECT policy on the new row.
  const { data: deleted, error } = await supabase.rpc("soft_delete_resource", { p_resource: id.data });
  if (error) return finish(l, detail(id.data), "error", catalogErrorMessage(error, "resource"));
  if (!deleted) return finish(l, "/admin/resources", "error", NOT_FOUND_OR_DENIED);
  return finish(l, "/admin/resources", "notice", "Resource deleted.");
}
