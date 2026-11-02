import { describe, expect, it } from "vitest";
import { nameFor } from "@/modules/library/queries";
import { coverPublicUrl } from "@/modules/library/urls";
import { absoluteUrl } from "@/lib/site";

const n = { name_en: "Fiqh", name_ur: "فقہ", name_ar: null };

describe("nameFor", () => {
  it("uses the visitor's language and falls back to English", () => {
    expect(nameFor(n, "en-pk")).toBe("Fiqh");
    expect(nameFor(n, "ur-pk")).toBe("فقہ");
    expect(nameFor(n, "ar")).toBe("Fiqh"); // no Arabic name stored
  });
});

describe("coverPublicUrl", () => {
  it("returns null without a path and encodes each segment", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
    expect(coverPublicUrl(null)).toBeNull();
    expect(coverPublicUrl("a b/cover.jpg", "2026-01-01T00:00:00Z")).toBe(
      "https://x.supabase.co/storage/v1/object/public/covers-public/a%20b/cover.jpg?v=2026-01-01T00%3A00%3A00Z");
  });
});

describe("absoluteUrl", () => {
  it("joins the configured origin without a double slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://ilm.example/";
    expect(absoluteUrl("/en-pk/library")).toBe("https://ilm.example/en-pk/library");
  });
});
