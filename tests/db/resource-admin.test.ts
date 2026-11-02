import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, denied, newUser, type Db } from "./harness";

let db: Db;
let admin: string, owner: string, other: string;
let academy: string, res: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) =>
  as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const listed = async () => (await q(null, `select id from resources where id=$1`, [res])).length === 1;
const setPermission = (set: string) => q(admin, `update copyright_permissions set ${set} where resource_id=$1`, [res]);

beforeAll(async () => {
  db = await createDb();
  [admin, owner, other] = await Promise.all(["admin", "owner", "other"].map((n) => newUser(db, n)));
  await db.query(`insert into platform_admins (user_id) values ($1)`, [admin]);
  academy = await as(db, owner, async () => (await db.query<{ r: string }>(`select register_academy('Academy One','academy-one') r`)).rows[0].r);
  await db.exec(`update academies set status='active'`);
  res = (await q(admin, `insert into resources (title,access_tier) values ('Darse Nizami Notes','free') returning id`))[0].id;
});

describe("public listing follows the distribution permission", () => {
  it("a draft with no permission is not listed", async () => {
    expect(await listed()).toBe(false);
  });

  it("approved + published is listed to anonymous visitors", async () => {
    await setPermission(`permission_status='approved', license_type='public_domain', evidence_reference='Public domain, pre-1900', allow_online_view=true`);
    await q(admin, `update resources set status='published' where id=$1`, [res]);
    expect(await listed()).toBe(true);
  });

  it.each(["removed", "rejected", "restricted", "expired"])("a takedown to '%s' delists it automatically", async (status) => {
    await setPermission(`permission_status='${status}'`);
    expect(await listed()).toBe(false);
    // staff/admin still see it so they can fix the record
    expect(await q(admin, `select id from resources where id=$1`, [res])).toHaveLength(1);
    await setPermission(`permission_status='approved', allow_online_view=true, evidence_reference='Public domain, pre-1900', license_type='public_domain'`);
    expect(await listed()).toBe(true);
  });

  it("a past expiry delists it without any job running; a future expiry keeps it listed", async () => {
    await setPermission(`expires_at = now() - interval '1 day'`);
    expect(await listed()).toBe(false);
    await setPermission(`expires_at = now() + interval '30 days'`);
    expect(await listed()).toBe(true);
    await setPermission(`expires_at = null`);
  });

  it("anonymous users still cannot read the permission record itself", async () => {
    expect(await denied(db, null, `select * from copyright_permissions`)).toBe(true);
  });
});

describe("uploads: replacement policies", () => {
  it("covers: only a super admin can replace; evidence: only the owning staff or admin", async () => {
    const cover = `${res}/cover.jpg`;
    await db.exec(`insert into storage.objects (bucket_id,name) values ('covers-public','${cover}')`);
    expect(await q(admin, `update storage.objects set name=name where bucket_id='covers-public' and name=$1 returning id`, [cover])).toHaveLength(1);
    expect(await q(owner, `update storage.objects set name=name where bucket_id='covers-public' and name=$1 returning id`, [cover])).toHaveLength(0);

    // evidence for a resource owned by the academy
    const owned = (await q(owner, `insert into resources (academy_id,title) values ($1,'Academy Book') returning id`, [academy]))[0].id;
    const ev = `${owned}/evidence.pdf`;
    await db.exec(`insert into storage.objects (bucket_id,name) values ('copyright-evidence','${ev}')`);
    expect(await q(owner, `update storage.objects set name=name where bucket_id='copyright-evidence' and name=$1 returning id`, [ev])).toHaveLength(1);
    expect(await q(other, `update storage.objects set name=name where bucket_id='copyright-evidence' and name=$1 returning id`, [ev])).toHaveLength(0);
  });

  it("soft delete hides a resource from admins and the public, keeping the row", async () => {
    const r = (await q(admin, `insert into resources (title) values ('To delete') returning id`))[0].id;
    // a direct UPDATE is rejected by RLS (the new row would not pass the SELECT policy); the function is the path
    expect(await denied(db, admin, `update resources set deleted_at=now() where id='${r}'`)).toBe(true);
    expect(await denied(db, other, `select soft_delete_resource('${r}')`)).toBe(true);
    expect((await q(admin, `select soft_delete_resource($1) ok`, [r]))[0].ok).toBe(true);
    expect((await q(admin, `select soft_delete_resource($1) ok`, [r]))[0].ok).toBe(false);
    expect(await q(admin, `select id from resources where id=$1`, [r])).toHaveLength(0);
    expect((await db.query(`select count(*)::int n from resources where id=$1`, [r])).rows[0]).toMatchObject({ n: 1 });
  });

  it("cover_path is stored on the resource", async () => {
    await q(admin, `update resources set cover_path=$2 where id=$1`, [res, `${res}/cover.jpg`]);
    expect((await q(admin, `select cover_path from resources where id=$1`, [res]))[0].cover_path).toBe(`${res}/cover.jpg`);
  });
});

describe("public_resource_info", () => {
  it("is empty for a draft and exposes only attribution + grants once listed", async () => {
    const r = (await q(admin, `insert into resources (title,access_tier) values ('Info test','free') returning id`))[0].id;
    expect(await q(null, `select * from public_resource_info($1)`, [r])).toHaveLength(0);
    await q(admin, `update copyright_permissions set permission_status='approved', license_type='open_license', evidence_reference='CC BY', attribution_text='Courtesy of X', allow_online_view=true where resource_id=$1`, [r]);
    expect(await q(null, `select * from public_resource_info($1)`, [r])).toHaveLength(0); // still draft
    await q(admin, `update resources set status='published' where id=$1`, [r]);
    const rows = await q(null, `select * from public_resource_info($1)`, [r]);
    expect(rows).toEqual([{ attribution_text: "Courtesy of X", license_type: "open_license", allow_online_view: true, allow_download: false }]);
    await q(admin, `update copyright_permissions set permission_status='removed' where resource_id=$1`, [r]);
    expect(await q(null, `select * from public_resource_info($1)`, [r])).toHaveLength(0);
  });
});
