import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { buildSitemapPaths } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

// Anonymous client: row-level security returns only published boards/subjects and books with a valid permission.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createPublicClient();
  const [boards, levels, links, books] = await Promise.all([
    db.from("boards").select("id, slug, updated_at").eq("status", "published"),
    db.from("levels").select("id, slug, board_id"),
    db.from("level_subjects").select("level_id, subjects!inner(slug, status)"),
    db.from("resources").select("id, updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(5000),
  ]);
  const boardSlug = new Map((boards.data ?? []).map((b) => [b.id, b.slug]));
  const levelById = new Map((levels.data ?? []).filter((l) => boardSlug.has(l.board_id)).map((l) => [l.id, { slug: l.slug, board_slug: boardSlug.get(l.board_id)! }]));

  const entries = buildSitemapPaths({
    boards: (boards.data ?? []).map((b) => ({ slug: b.slug, updated_at: b.updated_at })),
    levels: [...levelById.values()],
    subjectLinks: (links.data ?? []).flatMap((r) => {
      const level = levelById.get(r.level_id);
      return [r.subjects].flat().filter((s) => s && s.status === "published" && level)
        .map((s) => ({ board_slug: level!.board_slug, level_slug: level!.slug, subject_slug: s.slug }));
    }),
    books: books.data ?? [],
  });
  return entries.map((e) => ({ url: absoluteUrl(e.path), lastModified: e.lastModified }));
}
