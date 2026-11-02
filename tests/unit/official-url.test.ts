import { describe, expect, it } from "vitest";
import { resourceSchema } from "@/modules/library/schemas";
import { signupUrl } from "@/lib/auth/return-path";

const base = { title: "A book", kind: "book", access_tier: "free" };
const parse = (official_source_url?: string) => resourceSchema.safeParse({ ...base, official_source_url });

describe("official_source_url", () => {
  it("is optional and blank becomes null", () => {
    expect(parse(undefined)).toMatchObject({ success: true, data: { official_source_url: null } });
    expect(parse("   ")).toMatchObject({ success: true, data: { official_source_url: null } });
  });
  it("accepts http and https links", () => {
    expect(parse("https://publisher.example/book/1")).toMatchObject({ success: true, data: { official_source_url: "https://publisher.example/book/1" } });
    expect(parse("http://publisher.example").success).toBe(true);
  });
  it("rejects other schemes, relative links, spaces and overlong values", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.example/a", "/books/1", "publisher.example", "https://a b.example", "https://", "https://x.example/" + "a".repeat(500)]) {
      expect(parse(bad).success, bad).toBe(false);
    }
  });
});

describe("sign-up link from the reader", () => {
  it("carries the page to return to", () => {
    expect(signupUrl("en-pk", "/en-pk/books/abc/read")).toContain("next=");
  });
});
