import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let admin: string;

beforeAll(async () => {
  db = await createDb();
  admin = await newUser(db, "admin");
  await db.query(`insert into platform_admins (user_id) values ($1)`, [admin]);
});

const insert = async (url: string | null) =>
  as(db, admin, async () => (await db.query(`insert into resources (title, official_source_url) values ('Book', $1) returning official_source_url`, [url])).rows[0] as any);

describe("resources.official_source_url", () => {
  it("is optional", async () => {
    expect((await insert(null)).official_source_url).toBeNull();
  });
  it("stores an http(s) link", async () => {
    expect((await insert("https://publisher.example/book")).official_source_url).toBe("https://publisher.example/book");
  });
  it("refuses javascript:, data:, relative, spaced and overlong values", async () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "/relative", "https://a b.example", "https://x.example/" + "a".repeat(500)]) {
      await expect(insert(bad), bad).rejects.toThrow(/check constraint|official_source_url/);
    }
  });
});
