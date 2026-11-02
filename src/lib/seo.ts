import { href, locales } from "@/lib/i18n/config";

/** Private or per-user areas: kept out of search results (robots.txt here, X-Robots-Tag in the middleware). */
export const DISALLOWED_PATHS = [
  ...["account", "admin", "login", "signup", "forgot-password", "reset-password"].map((p) => `/*/${p}`),
  "/*/books/*/read",
  "/auth/",
  "/api/",
];

export type SitemapSource = {
  boards: { slug: string; updated_at: string }[];
  levels: { slug: string; board_slug: string }[];
  subjectLinks: { board_slug: string; level_slug: string; subject_slug: string }[];
  books: { id: string; updated_at: string }[];
};

export type SitemapEntry = { path: string; lastModified?: string };

/** Every public path, once per language. Pure so it can be tested without a database. */
export function buildSitemapPaths(src: SitemapSource): SitemapEntry[] {
  const base: SitemapEntry[] = [{ path: "/" }, { path: "/library" }];
  for (const b of src.boards) base.push({ path: `/library/${b.slug}`, lastModified: b.updated_at });
  for (const l of src.levels) base.push({ path: `/library/${l.board_slug}/${l.slug}` });
  for (const s of src.subjectLinks) base.push({ path: `/library/${s.board_slug}/${s.level_slug}/${s.subject_slug}` });
  for (const bk of src.books) base.push({ path: `/books/${bk.id}`, lastModified: bk.updated_at });
  return locales.flatMap((l) => base.map((e) => ({ path: href(l, e.path), lastModified: e.lastModified })));
}
