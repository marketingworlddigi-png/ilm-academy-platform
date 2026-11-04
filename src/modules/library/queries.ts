import type { SupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/lib/i18n/config";

// Read-only queries for the public library. They run with the anonymous client, so row-level security
// decides what exists: unpublished boards and subjects, and resources without a valid permission, simply come back empty.

type Named = { name_en: string; name_ur: string | null; name_ar: string | null };

/** Display name in the visitor's language, falling back to English. */
export function nameFor(n: Named, locale: Locale): string {
  const v = locale === "ur-pk" ? n.name_ur : locale === "ar" ? n.name_ar : null;
  return v || n.name_en;
}

export const BOOK_COLUMNS =
  "id, title, title_ur, title_ar, author, publisher, edition, language, publication_year, description, kind, access_tier, cover_path, updated_at, created_at, board_id, level_id, subject_id";

export async function listBoards(db: SupabaseClient) {
  const { data } = await db.from("boards").select("id, slug, name_en, name_ur, name_ar, description").eq("status", "published").order("sort_order").order("name_en");
  return data ?? [];
}

export async function getBoard(db: SupabaseClient, slug: string) {
  const { data } = await db.from("boards").select("id, slug, name_en, name_ur, name_ar, description").eq("slug", slug).eq("status", "published").maybeSingle();
  return data;
}

export async function listLevels(db: SupabaseClient, boardId: string) {
  const { data } = await db.from("levels").select("id, slug, name_en, name_ur, name_ar").eq("board_id", boardId).order("sort_order").order("name_en");
  return data ?? [];
}

export async function getLevel(db: SupabaseClient, boardId: string, slug: string) {
  const { data } = await db.from("levels").select("id, slug, name_en, name_ur, name_ar").eq("board_id", boardId).eq("slug", slug).maybeSingle();
  return data;
}

export async function listSubjectsForLevel(db: SupabaseClient, levelId: string) {
  const { data } = await db.from("level_subjects").select("subjects!inner(id, slug, name_en, name_ur, name_ar, status, sort_order)").eq("level_id", levelId);
  const rows = (data ?? []).flatMap((r) => [r.subjects].flat()).filter((s) => s && s.status === "published");
  return rows.sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en));
}

export async function getSubjectBySlug(db: SupabaseClient, slug: string) {
  const { data } = await db.from("subjects").select("id, slug, name_en, name_ur, name_ar").eq("slug", slug).eq("status", "published").maybeSingle();
  return data;
}

export async function listBooks(db: SupabaseClient, filter: { levelId: string; subjectId: string }) {
  const { data } = await db.from("resources").select(BOOK_COLUMNS).eq("status", "published")
    .eq("level_id", filter.levelId).eq("subject_id", filter.subjectId).order("title").limit(200);
  return data ?? [];
}

export async function getBook(db: SupabaseClient, id: string) {
  const { data: row } = await db.from("resources").select(`${BOOK_COLUMNS}, official_source_url, storage_path`).eq("id", id).eq("status", "published").maybeSingle();
  if (!row) return null;
  const { storage_path, ...data } = row; // the storage path is never sent to the page, only whether a file exists
  const [{ data: info }, board, level, subject] = await Promise.all([
    db.rpc("public_resource_info", { p_resource: id }),
    data.board_id ? db.from("boards").select("slug, name_en, name_ur, name_ar").eq("id", data.board_id).maybeSingle() : null,
    data.level_id ? db.from("levels").select("slug, name_en, name_ur, name_ar").eq("id", data.level_id).maybeSingle() : null,
    data.subject_id ? db.from("subjects").select("slug, name_en, name_ur, name_ar").eq("id", data.subject_id).maybeSingle() : null,
  ]);
  return { ...data, has_file: !!storage_path, info: (info as { attribution_text: string | null; license_type: string; allow_online_view: boolean; allow_download: boolean }[] | null)?.[0] ?? null,
    board: board?.data ?? null, level: level?.data ?? null, subject: subject?.data ?? null };
}

/** Level names are stored as "Transliteration (Darja) - Equivalent"; the part after the dash is the school-system equivalent. */
export function splitLevelName(n: string): { latin: string; equiv: string | null } {
  const [a, ...r] = n.split(" - ");
  return { latin: a, equiv: r.join(" - ") || null };
}

/** Published book counts per subject for one level, in a single query. */
export async function countBooksBySubject(db: SupabaseClient, levelId: string): Promise<Map<string, number>> {
  const { data } = await db.from("resources").select("subject_id").eq("status", "published").eq("level_id", levelId).limit(2000);
  const m = new Map<string, number>();
  for (const r of data ?? []) if (r.subject_id) m.set(r.subject_id, (m.get(r.subject_id) ?? 0) + 1);
  return m;
}
