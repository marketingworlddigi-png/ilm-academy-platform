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

describe("resubmit for review", () => {
  let id: string;
  beforeAll(async () => {
    id = await register(await newUser(db, "resub-owner").then((u) => (resubOwner = u)), "Resubmit Academy", "resubmit-academy");
  });
  let resubOwner: string;

  it("is refused while pending is not applicable: pending is a no-op, active cannot resubmit", async () => {
    await q(resubOwner, `select resubmit_academy($1)`, [id]); // already pending: idempotent
    expect((await row(id)).status).toBe("pending");
    await q(admin, `select review_academy($1,'active',null)`, [id]);
    expect(await failure(resubOwner, `select resubmit_academy($1)`, [id])).toMatch(/sent back or not approved/);
  });

  it("an owner can resubmit after needs_info or rejection; the note stays and it is audited", async () => {
    await q(admin, `select review_academy($1,'needs_info','Add your teachers')`, [id]);
    await q(resubOwner, `select resubmit_academy($1)`, [id]);
    expect(await row(id)).toMatchObject({ status: "pending", status_note: "Add your teachers" });
    await q(admin, `select review_academy($1,'rejected','Incomplete')`, [id]);
    await q(resubOwner, `select resubmit_academy($1)`, [id]);
    expect((await row(id)).status).toBe("pending");
    expect((await db.query(`select 1 from audit_logs where action='academy.resubmitted' and entity_id=$1`, [id])).rows).toHaveLength(2);
  });

  it("a suspended academy cannot be resubmitted", async () => {
    await q(admin, `select review_academy($1,'suspended','Investigating')`, [id]);
    expect(await failure(resubOwner, `select resubmit_academy($1)`, [id])).toMatch(/sent back or not approved/);
  });

  it("strangers and academy admins who are not the owner cannot resubmit; ids are not revealed", async () => {
    await q(admin, `select review_academy($1,'needs_info','More detail please')`, [id]);
    const helper = await newUser(db, "resub-helper");
    await db.query(`insert into memberships (academy_id,user_id,role) values ($1,$2,'academy_admin')`, [id, helper]);
    expect(await failure(other, `select resubmit_academy($1)`, [id])).toMatch(/not found/);
    expect(await failure(helper, `select resubmit_academy($1)`, [id])).toMatch(/not found/);
    expect(await failure(other, `select resubmit_academy(gen_random_uuid())`)).toMatch(/not found/);
    expect(await failure(null, `select resubmit_academy($1)`, [id])).toMatch(/permission denied/);
  });

  it("the status still cannot be changed directly by the owner, even toward pending", async () => {
    expect(await failure(resubOwner, `update academies set status='pending' where id=$1`, [id])).toMatch(/platform administrator/);
    expect(await failure(resubOwner, `update academies set status='active' where id=$1`, [id])).toMatch(/platform administrator/);
  });

  it("the three-academy cap applies to resubmission", async () => {
    const o = await newUser(db, "capowner");
    const rejected = await register(o, "Cap One", "cap-one");
    await q(admin, `select review_academy($1,'rejected','Not enough detail')`, [rejected]);
    await register(o, "Cap Two", "cap-two"); await register(o, "Cap Three", "cap-three"); await register(o, "Cap Four", "cap-four");
    expect(await failure(o, `select resubmit_academy($1)`, [rejected])).toMatch(/maximum/);
  });
});
