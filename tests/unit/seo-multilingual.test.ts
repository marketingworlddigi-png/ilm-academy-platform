import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// The layout loads Google fonts and global CSS at import time; neither exists under vitest.
const font = () => ({ variable: "" });
vi.mock("next/font/google", () => ({ Inter: font, Newsreader: font, Noto_Naskh_Arabic: font }));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/components/read-action", () => ({ ReadAction: () => null }));
const getBook = vi.fn();
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({}) }));
vi.mock("@/modules/library/queries", async (orig) => ({ ...(await orig<object>()), getBook: (...a: unknown[]) => getBook(...a) }));

const ID = "3f1c2a5e-8b1d-4c7a-9d0e-1a2b3c4d5e6f";
const book = { id: ID, title: "Al-Ajrumiyyah", title_ur: null, title_ar: null, author: "Ibn Ajurrum", description: "A primer.", cover_path: null, updated_at: "2026-01-01", info: null };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://ilm.example";
  getBook.mockResolvedValue(book);
});

describe("canonical URLs", () => {
  it("book page canonical is absolute and uses NEXT_PUBLIC_SITE_URL", async () => {
    const { generateMetadata } = await import("@/app/[locale]/books/[id]/page");
    const m = await generateMetadata({ params: Promise.resolve({ locale: "en-pk", id: ID }) } as never);
    expect(m.alternates?.canonical).toBe(`https://ilm.example/en-pk/books/${ID}`);
    expect(m.alternates?.languages).toMatchObject({ "en-PK": `https://ilm.example/en-pk/books/${ID}`, "x-default": `https://ilm.example/en-pk/books/${ID}` });
  });

  it("the locale layout sets metadataBase from NEXT_PUBLIC_SITE_URL", async () => {
    const { generateMetadata } = await import("@/app/[locale]/layout");
    const m = await generateMetadata({ params: Promise.resolve({ locale: "en-pk" }) } as never);
    expect((m.metadataBase as URL).href).toBe("https://ilm.example/");
  });
});

describe("untranslated languages", () => {
  it("ur-pk and ar are noindex,follow; en-pk is indexable", async () => {
    const { generateMetadata } = await import("@/app/[locale]/layout");
    const robots = async (locale: string) => (await generateMetadata({ params: Promise.resolve({ locale }) } as never)).robots;
    expect(await robots("ur-pk")).toEqual({ index: false, follow: true });
    expect(await robots("ar")).toEqual({ index: false, follow: true });
    expect(await robots("en-pk")).toEqual({ index: true, follow: true });
  });

  it("alternatesFor lists only translated languages, and grows when one is added", async () => {
    const seo = await import("@/lib/seo");
    expect(Object.keys(seo.alternatesFor("ur-pk", "/library").languages)).toEqual(["en-PK", "x-default"]);
    expect(seo.alternatesFor("ur-pk", "/library").canonical).toBe("https://ilm.example/ur-pk/library");
    (seo.TRANSLATED_LOCALES as string[]).push("ur-pk");
    try {
      expect(seo.alternatesFor("en-pk", "/library").languages["ur-PK"]).toBe("https://ilm.example/ur-pk/library");
      expect(seo.isTranslated("ur-pk")).toBe(true);
    } finally { (seo.TRANSLATED_LOCALES as string[]).pop(); }
  });
});
