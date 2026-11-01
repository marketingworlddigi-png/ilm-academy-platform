import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FilePurpose = "view" | "download";
export type FileAccessResult =
  | { ok: true; url: string; expiresInSeconds: number }
  | { ok: false; reason: "denied" | "no_file" | "sign_failed" };

const BUCKET = "resources-private";
const TTL_SECONDS = 60;

/**
 * Issues a short-lived signed URL for a protected file.
 * `supabase` MUST be the per-request user client (RLS applies), never the admin client:
 * the database function public.can_access_resource() is the single source of truth, and the storage
 * policy re-checks it, so a leaked URL expires quickly and direct bucket access is still denied.
 * Note: "view" prevents unauthorised access but cannot technically stop an authorised viewer saving the file.
 */
export async function getProtectedFileUrl(supabase: SupabaseClient, resourceId: string, purpose: FilePurpose): Promise<FileAccessResult> {
  const { data: allowed, error } = await supabase.rpc("can_access_resource", { p_resource: resourceId, p_purpose: purpose });
  if (error || allowed !== true) return { ok: false, reason: "denied" };

  const { data: row } = await supabase.from("resources").select("storage_path").eq("id", resourceId).maybeSingle();
  if (!row?.storage_path) return { ok: false, reason: "no_file" };

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, TTL_SECONDS, purpose === "download" ? { download: true } : undefined);
  if (signError || !data) return { ok: false, reason: "sign_failed" };
  return { ok: true, url: data.signedUrl, expiresInSeconds: TTL_SECONDS };
}
