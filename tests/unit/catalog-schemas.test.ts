import { describe, expect, it } from "vitest";
import { boardSchema, levelSchema, subjectSchema, uuidList } from "@/modules/catalog/schemas";
import { catalogErrorMessage } from "@/modules/catalog/errors";

const ID = "539a753f-082b-4040-b3f8-15ec7b0c4fe1";

describe("catalog schemas", () => {
  it("board: normalises slug, blanks become null, sort order is coerced", () => {
    const r = boardSchema.parse({ slug: " Wifaq-UL-Madaris ", name_en: "Wifaq", name_ur: "", name_ar: "", status: "draft", sort_order: "3", description: "" });
    expect(r).toMatchObject({ slug: "wifaq-ul-madaris", name_ur: null, name_ar: null, description: null, sort_order: 3 });
  });
  it("board: empty sort order defaults to 0 and unknown fields are dropped", () => {
    const r = boardSchema.parse({ slug: "a-b", name_en: "AB", status: "published", sort_order: "", locale: "en-pk", id: ID });
    expect(r.sort_order).toBe(0);
    expect(r).not.toHaveProperty("locale");
    expect(r).not.toHaveProperty("id");
  });
  it.each(["Has Space", "-lead", "trail-", "dou--ble", "ünï", "a/b", ""])("rejects slug %j", (slug) => {
    expect(boardSchema.safeParse({ slug, name_en: "Valid", status: "draft" }).success).toBe(false);
  });
  it("rejects bad status, short names and negative sort order", () => {
    expect(boardSchema.safeParse({ slug: "a", name_en: "Valid", status: "in_review" }).success).toBe(false);
    expect(boardSchema.safeParse({ slug: "a", name_en: "x", status: "draft" }).success).toBe(false);
    expect(boardSchema.safeParse({ slug: "a", name_en: "Valid", status: "draft", sort_order: "-1" }).success).toBe(false);
  });
  it("level: needs a uuid board_id", () => {
    expect(levelSchema.safeParse({ board_id: ID, slug: "year-1", name_en: "Year 1" }).success).toBe(true);
    expect(levelSchema.safeParse({ board_id: "nope", slug: "year-1", name_en: "Year 1" }).success).toBe(false);
  });
  it("subject: accepts archived", () => {
    expect(subjectSchema.safeParse({ slug: "nahw", name_en: "Nahw", status: "archived" }).success).toBe(true);
  });
  it("uuidList keeps valid ids once and drops the rest", () => {
    expect(uuidList([ID, ID, "garbage", "' or 1=1 --", ""])).toEqual([ID]);
  });
});

describe("catalogErrorMessage", () => {
  it("maps known Postgres codes", () => {
    expect(catalogErrorMessage({ code: "23505" }, "board")).toMatch(/slug already exists/);
    expect(catalogErrorMessage({ code: "23503" }, "board")).toMatch(/still in use/);
    expect(catalogErrorMessage({ code: "23001" }, "board")).toMatch(/still in use/); // ON DELETE RESTRICT
    expect(catalogErrorMessage({ code: "42501" }, "board")).toMatch(/permission/);
  });
  it("never leaks raw database text for unknown errors", () => {
    expect(catalogErrorMessage({ code: "XX000" }, "level")).toBe("Could not save the level. Please try again.");
    expect(catalogErrorMessage(null, "level")).toMatch(/Could not save/);
  });
});
