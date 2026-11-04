import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchLibrary } from "@/modules/library/queries";

// A tiny in-memory stand-in for the PostgREST builder: supports select/eq/in/or(ilike)/order/limit and is awaitable.
type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  const from = (name: string) => {
    let rows = [...(tables[name] ?? [])];
    const b = {
      select: () => b,
      eq: (c: string, v: unknown) => { rows = rows.filter((r) => r[c] === v); return b; },
      in: (c: string, vs: unknown[]) => { rows = rows.filter((r) => vs.includes(r[c])); return b; },
      or: (expr: string) => {
        const conds = expr.split(",").map((p) => { const [col, op, ...rest] = p.split("."); return { col, op, val: rest.join(".").replace(/%/g, "").toLowerCase() }; });
        rows = rows.filter((r) => conds.some((c) => c.op === "ilike" && String(r[c.col] ?? "").toLowerCase().includes(c.val)));
        return b;
      },
      order: () => b,
      limit: (n: number) => { rows = rows.slice(0, n); return b; },
      then: (ok: (v: { data: Row[] }) => unknown) => Promise.resolve({ data: rows }).then(ok),
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

const book = (id: string, title: string, subject_id: string | null, extra: Row = {}) =>
  ({ id, title, title_ur: null, title_ar: null, author: null, status: "published", subject_id, ...extra });

const db = fakeDb({
  subjects: [
    { id: "s-nahw", slug: "nahw", name_en: "Nahw", name_ur: "نحو", name_ar: "النحو", status: "published" },
    { id: "s-sarf", slug: "sarf", name_en: "Sarf", name_ur: "صرف", name_ar: null, status: "published" },
    { id: "s-draft", slug: "nahw-draft", name_en: "Nahw Draft", name_ur: null, name_ar: null, status: "draft" },
  ],
  level_subjects: [
    { subject_id: "s-nahw", levels: { slug: "awwal", name_en: "Awwal (First)", boards: { slug: "wifaq" } } },
    { subject_id: "s-sarf", levels: { slug: "awwal", name_en: "Awwal (First)", boards: { slug: "wifaq" } } },
  ],
  resources: [
    book("b1", "Sharh Mi'at Amil", "s-nahw"),
    book("b2", "Hidayat un-Nahw", "s-nahw"),
    book("b3", "Mizan us-Sarf", "s-sarf"),
    book("b4", "Nahw Mir", null, { author: "Mir Sayyid" }),
    book("b5", "Hidden nahw draft", "s-nahw", { status: "draft" }),
  ],
});

describe("searchLibrary", () => {
  it('"nahw" returns the Nahw subject and its books (including ones whose title lacks the word)', async () => {
    const r = await searchLibrary(db, "nahw");
    expect(r.subjects.map((s) => s.slug)).toEqual(["nahw"]);
    expect(r.subjects[0]).toMatchObject({ boardSlug: "wifaq", levelSlug: "awwal" });
    expect(r.books.map((b) => b.id).sort()).toEqual(["b1", "b2", "b4"]);
    expect(r.books.map((b) => b.id)).not.toContain("b3");
  });
  it("is case-insensitive", async () => {
    expect((await searchLibrary(db, "NAHW")).subjects.map((s) => s.slug)).toEqual(["nahw"]);
  });
  it("matches Urdu and Arabic subject names", async () => {
    expect((await searchLibrary(db, "نحو")).subjects.map((s) => s.slug)).toEqual(["nahw"]);
    expect((await searchLibrary(db, "النحو")).subjects.map((s) => s.slug)).toEqual(["nahw"]);
  });
  it("does not duplicate a book that matches both by title and by subject", async () => {
    const ids = (await searchLibrary(db, "nahw")).books.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("returns nothing for an unrelated word", async () => {
    expect(await searchLibrary(db, "zzz")).toEqual({ subjects: [], books: [] });
  });
});
