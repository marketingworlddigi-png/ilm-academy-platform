import { describe, expect, it } from "vitest";
import { buildSitemapPaths, DISALLOWED_PATHS } from "@/lib/seo";
import robots from "@/app/robots";

const src = {
  boards: [{ slug: "wifaq", updated_at: "2026-01-01T00:00:00Z" }],
  levels: [{ slug: "aalimiyyah", board_slug: "wifaq" }],
  subjectLinks: [{ board_slug: "wifaq", level_slug: "aalimiyyah", subject_slug: "fiqh" }],
  books: [{ id: "b1", updated_at: "2026-02-01T00:00:00Z" }],
};

describe("buildSitemapPaths", () => {
  const paths = buildSitemapPaths(src).map((e) => e.path);
  it("lists every public page once per language", () => {
    for (const l of ["en-pk", "ur-pk", "ar"]) {
      expect(paths).toContain(`/${l}`);
      expect(paths).toContain(`/${l}/library`);
      expect(paths).toContain(`/${l}/library/wifaq`);
      expect(paths).toContain(`/${l}/library/wifaq/aalimiyyah`);
      expect(paths).toContain(`/${l}/library/wifaq/aalimiyyah/fiqh`);
      expect(paths).toContain(`/${l}/books/b1`);
    }
    expect(paths).toHaveLength(18);
  });
  it("never includes account, admin, auth or reader pages", () => {
    expect(paths.some((p) => /\/(account|admin|login|signup|forgot-password|reset-password)|\/read$/.test(p))).toBe(false);
  });
  it("carries lastModified for boards and books", () => {
    expect(buildSitemapPaths(src).find((e) => e.path === "/en-pk/books/b1")?.lastModified).toBe("2026-02-01T00:00:00Z");
  });
});

describe("robots", () => {
  it("blocks account, admin, login, signup and the reader, and points at the sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    for (const p of ["/*/account", "/*/admin", "/*/login", "/*/signup", "/*/books/*/read"]) expect(rule.disallow).toContain(p);
    expect(DISALLOWED_PATHS).toContain("/auth/");
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
  });
});
