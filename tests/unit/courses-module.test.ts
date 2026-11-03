import { describe, expect, it } from "vitest";
import { courseErrorMessage, courseSchema, lessonSchema, newCourseSchema, suggestCourseSlug } from "@/modules/courses/schemas";
import { buildSitemapPaths, DISALLOWED_PATHS } from "@/lib/seo";

const empty = { boards: [], levels: [], subjectLinks: [], books: [] };

describe("course schemas", () => {
  it("needs a title and a valid web address", () => {
    expect(newCourseSchema.safeParse({ title: "Sarf Basics", slug: "sarf-basics" }).success).toBe(true);
    expect(newCourseSchema.safeParse({ title: "ab", slug: "sarf-basics" }).success).toBe(false);
    for (const slug of ["a", "-bad-", "Has Space", "../x", "UPPER_case"]) expect(newCourseSchema.safeParse({ title: "Sarf Basics", slug }).success, slug).toBe(false);
  });
  it("lowercases the slug and turns blank optional text into null", () => {
    expect(courseSchema.parse({ title: "Sarf Basics", slug: "Sarf-Basics", summary: " ", description: "" })).toMatchObject({ slug: "sarf-basics", summary: null, description: null });
  });
  it("limits lesson text and reads the preview checkbox", () => {
    expect(lessonSchema.parse({ title: "Intro", is_preview: "on" })).toMatchObject({ is_preview: true, body: null, resource_id: null });
    expect(lessonSchema.parse({ title: "Intro" }).is_preview).toBe(false);
    expect(lessonSchema.safeParse({ title: "Intro", body: "x".repeat(20001) }).success).toBe(false);
    expect(lessonSchema.safeParse({ title: "Intro", resource_id: "not-a-uuid" }).success).toBe(false);
  });
  it("suggests a slug", () => expect(suggestCourseSlug("Sarf: Basics & More!")).toBe("sarf-basics-more"));
  it("maps database errors to readable messages", () => {
    expect(courseErrorMessage({ code: "23505" })).toMatch(/already used/);
    expect(courseErrorMessage({ code: "55000", message: "A published course needs at least one lesson; unpublish it first" })).toMatch(/at least one lesson/);
    expect(courseErrorMessage({ code: "XX000", message: "internal detail" })).not.toMatch(/internal detail/);
  });
});

describe("course search and crawling rules", () => {
  it("lists /courses and each published course, but no lesson pages", () => {
    const paths = buildSitemapPaths({ ...empty, courses: [{ academy_slug: "noor-academy", slug: "sarf-basics", updated_at: "2026-11-01T00:00:00Z" }] }).map((e) => e.path);
    expect(paths).toContain("/en-pk/courses");
    expect(paths).toContain("/en-pk/courses/noor-academy/sarf-basics");
    expect(paths.some((p) => p.includes("/lessons"))).toBe(false);
  });
  it("still works when no courses are passed", () => {
    expect(buildSitemapPaths(empty).map((e) => e.path)).toContain("/en-pk/courses");
  });
  it("keeps lesson pages out of robots.txt", () => {
    expect(DISALLOWED_PATHS).toContain("/*/courses/*/*/lessons/");
  });
});
