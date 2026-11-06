import { defaultLocale, href, htmlLangOf, type Locale } from "@/lib/i18n/config";
import { absoluteUrl } from "@/lib/site";

/**
 * Languages whose pages have real, human-reviewed translations. Until Urdu and Arabic copy lands, those routes
 * still serve English text, so they are kept out of the sitemap and marked noindex (links are still followed).
 * Add a locale here when its translation ships; sitemap, robots meta and hreflang all follow automatically.
 */
export const TRANSLATED_LOCALES: readonly Locale[] = ["en-pk"];
export const isTranslated = (l: Locale) => TRANSLATED_LOCALES.includes(l);

/** Robots meta for a language's pages: untranslated languages are noindex,follow. */
export const robotsForLocale = (l: Locale) => (isTranslated(l) ? { index: true, follow: true } : { index: false, follow: true });

/** Canonical (absolute, self-referencing) plus hreflang alternates for every translated language and x-default. */
export function alternatesFor(locale: Locale, path: string) {
  const languages: Record<string, string> = {};
  for (const l of TRANSLATED_LOCALES) languages[htmlLangOf(l)] = absoluteUrl(href(l, path));
  languages["x-default"] = absoluteUrl(href(defaultLocale, path));
  return { canonical: absoluteUrl(href(locale, path)), languages };
}

/** Private or per-user areas: kept out of search results (robots.txt here, X-Robots-Tag in the middleware). */
export const DISALLOWED_PATHS = [
  ...["account", "admin", "login", "signup", "forgot-password", "reset-password", "checkout", "academy"].map((p) => `/*/${p}`),
  "/*/books/*/read",
  "/*/certificates/",
  "/*/courses/*/*/lessons/",
  "/auth/",
  "/api/",
];

export type SitemapSource = {
  boards: { slug: string; updated_at: string }[];
  levels: { slug: string; board_slug: string }[];
  subjectLinks: { board_slug: string; level_slug: string; subject_slug: string }[];
  books: { id: string; updated_at: string }[];
  courses?: { academy_slug: string; slug: string; updated_at: string }[];
};

export type SitemapEntry = { path: string; lastModified?: string };

/** Every public path, once per translated language. Pure so it can be tested without a database. */
export function buildSitemapPaths(src: SitemapSource): SitemapEntry[] {
  const base: SitemapEntry[] = [{ path: "/" }, { path: "/library" }, { path: "/courses" }, { path: "/pricing" }];
  for (const b of src.boards) base.push({ path: `/library/${b.slug}`, lastModified: b.updated_at });
  for (const l of src.levels) base.push({ path: `/library/${l.board_slug}/${l.slug}` });
  for (const s of src.subjectLinks) base.push({ path: `/library/${s.board_slug}/${s.level_slug}/${s.subject_slug}` });
  for (const bk of src.books) base.push({ path: `/books/${bk.id}`, lastModified: bk.updated_at });
  for (const c of src.courses ?? []) base.push({ path: `/courses/${c.academy_slug}/${c.slug}`, lastModified: c.updated_at });
  return TRANSLATED_LOCALES.flatMap((l) => base.map((e) => ({ path: href(l, e.path), lastModified: e.lastModified })));
}
