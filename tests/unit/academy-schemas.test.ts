import { describe, expect, it } from "vitest";
import { academyErrorMessage, academyProfileSchema, registerAcademySchema, reviewAcademySchema, suggestSlug } from "@/modules/academies/schemas";

describe("registerAcademySchema", () => {
  it("normalises the slug and trims the name", () => {
    const r = registerAcademySchema.parse({ name: "  Noor Academy ", slug: " Noor-Academy " });
    expect(r).toEqual({ name: "Noor Academy", slug: "noor-academy" });
  });
  it("rejects bad slugs", () => {
    for (const slug of ["ab", "-abc", "abc-", "a b c", "abc_def", "x".repeat(41), "نور"]) {
      expect(registerAcademySchema.safeParse({ name: "Good", slug }).success, slug).toBe(false);
    }
  });
  it("rejects reserved web addresses", () => {
    expect(registerAcademySchema.safeParse({ name: "Good", slug: "admin" }).success).toBe(false);
    expect(registerAcademySchema.safeParse({ name: "Good", slug: "library" }).success).toBe(false);
  });
  it("requires a real name", () => {
    expect(registerAcademySchema.safeParse({ name: "A", slug: "valid-slug" }).success).toBe(false);
  });
});

describe("academyProfileSchema", () => {
  it("makes an empty description null", () => {
    expect(academyProfileSchema.parse({ name: "Noor", description: "  " }).description).toBeNull();
  });
});

describe("reviewAcademySchema", () => {
  it("approval needs no note", () => {
    expect(reviewAcademySchema.safeParse({ status: "active" }).success).toBe(true);
  });
  it("anything else needs a note", () => {
    for (const status of ["needs_info", "rejected", "suspended"]) {
      expect(reviewAcademySchema.safeParse({ status }).success, status).toBe(false);
      expect(reviewAcademySchema.safeParse({ status, note: "Missing documents" }).success, status).toBe(true);
    }
  });
  it("cannot set pending", () => {
    expect(reviewAcademySchema.safeParse({ status: "pending", note: "x y z" }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("suggests a slug", () => {
    expect(suggestSlug("Noor Academy (Karachi)")).toBe("noor-academy-karachi");
    expect(suggestSlug("  --Al-Falah!! ")).toBe("al-falah");
  });
  it("hides internals in error messages", () => {
    expect(academyErrorMessage({ code: "23505" })).toMatch(/already taken/);
    expect(academyErrorMessage({ code: "22023", message: "That web address is reserved" })).toBe("That web address is reserved");
    expect(academyErrorMessage({ code: "XX000", message: "relation foo" })).toBe("Something went wrong. Please try again.");
  });
});
