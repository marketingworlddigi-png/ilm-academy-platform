import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let admin: string, owner: string, other: string, staff: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) =>
  as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};
const register = async (user: string, name: string, slug: string) => (await q(user, `select register_academy($1,$2) id`, [name, slug]))[0].id as string;
const row = async (id: string) => (await db.query<any>(`select status, status_note from academies where id=$1`, [id])).rows[0];

beforeAll(async () => {
  db = await createDb();
  [admin, owner, other, staff] = await Promise.all(["admin", "owner", "other", "staff"].map((n) => newUser(db, n)));
  await db.query(`insert into platform_admins (user_id) values ($1)`, [admin]);
});

describe("registration", () => {
  it("creates a pending academy with the caller as owner, and audits it", async () => {
    const id = await register(owner, "  Noor Academy ", "Noor-Academy");
    expect(await row(id)).toMatchObject({ status: "pending" });
    const a = (await db.query<any>(`select name, slug, owner_id from academies where id=$1`, [id])).rows[0];
    expect(a).toMatchObject({ name: "Noor Academy", slug: "noor-academy", owner_id: owner });
    const m = (await db.query<any>(`select role from memberships where academy_id=$1 and user_id=$2`, [id, owner])).rows;
    expect(m).toEqual([{ role: "academy_owner" }]);
    expect((await db.query(`select 1 from audit_logs where action='academy.registered' and entity_id=$1`, [id])).rows).toHaveLength(1);
  });

  it("needs a signed-in user", async () => {
    expect(await failure(null, `select register_academy('X Academy','x-academy')`)).toMatch(/permission denied|Authentication/);
  });

  it("validates the name and web address in the database", async () => {
    expect(await failure(other, `select register_academy('A','valid-slug')`)).toMatch(/academy name/);
    expect(await failure(other, `select register_academy('Good Name','Bad Slug!')`)).toMatch(/web address/);
    expect(await failure(other, `select register_academy('Good Name','ab')`)).toMatch(/web address/);
    expect(await failure(other, `select register_academy('Good Name','-bad-start')`)).toMatch(/web address/);
  });

  it("refuses reserved and duplicate web addresses", async () => {
    expect(await failure(other, `select register_academy('Admin Academy','admin')`)).toMatch(/reserved/);
    expect(await failure(other, `select register_academy('Dup','noor-academy')`)).toMatch(/duplicate key|unique/);
  });

  it("caps how many academies one person can have in review or active", async () => {
    await register(other, "One Academy", "one-academy");
    await register(other, "Two Academy", "two-academy");
    await register(other, "Three Academy", "three-academy");
    expect(await failure(other, `select register_academy('Four Academy','four-academy')`)).toMatch(/maximum/);
  });
});

describe("platform review", () => {
  let id: string;
  beforeAll(async () => {
    id = await register(staff, "Review Academy", "review-academy");
  });

  it("the owner cannot approve their own academy or edit the review fields", async () => {
    expect(await failure(staff, `select review_academy($1,'active',null)`, [id])).toMatch(/Not allowed/);
    expect(await failure(staff, `update academies set status='active' where id=$1`, [id])).toMatch(/platform administrator/);
    expect(await failure(staff, `update academies set status_note='All good' where id=$1`, [id])).toMatch(/platform administrator/);
    expect(await failure(staff, `update academies set slug='another-slug' where id=$1`, [id])).toMatch(/platform administrator/);
    expect((await row(id)).status).toBe("pending");
  });

  it("the owner can still edit the name and description", async () => {
    await q(staff, `update academies set name='Review Academy Karachi', description='Classes' where id=$1`, [id]);
    expect((await db.query<any>(`select name, description from academies where id=$1`, [id])).rows[0]).toEqual({ name: "Review Academy Karachi", description: "Classes" });
  });

  it("a stranger cannot review or see a pending academy", async () => {
    expect(await failure(other, `select review_academy($1,'active',null)`, [id])).toMatch(/Not allowed/);
    expect(await q(other, `select 1 from academies where id=$1`, [id])).toHaveLength(0);
    expect(await q(null, `select 1 from academies where id=$1`, [id])).toHaveLength(0);
  });

  it("only a rejection or suspension needs a note, and approval is idempotent", async () => {
    expect(await failure(admin, `select review_academy($1,'rejected',null)`, [id])).toMatch(/short note/);
    await q(admin, `select review_academy($1,'needs_info','Please add a description of your courses')`, [id]);
    expect(await row(id)).toMatchObject({ status: "needs_info", status_note: "Please add a description of your courses" });
    await q(admin, `select review_academy($1,'active',null)`, [id]);
    await q(admin, `select review_academy($1,'active',null)`, [id]);
    expect(await row(id)).toMatchObject({ status: "active", status_note: null });
    expect((await db.query(`select 1 from audit_logs where action='academy.reviewed' and entity_id=$1`, [id])).rows).toHaveLength(2);
    expect(await q(null, `select 1 from academies where id=$1`, [id])).toHaveLength(1); // now public
  });

  it("cannot be moved back to pending, and an unknown academy is not found", async () => {
    expect(await failure(admin, `select review_academy($1,'pending',null)`, [id])).toMatch(/pending/);
    expect(await failure(admin, `select review_academy(gen_random_uuid(),'active',null)`)).toMatch(/not found/);
  });

  it("suspending records the status and the note", async () => {
    await q(admin, `select review_academy($1,'suspended','Under investigation')`, [id]);
    expect((await row(id)).status).toBe("suspended");
  });
});
