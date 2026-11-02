import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, denied, newUser, type Db } from "./harness";

let db: Db;
let admin: string, ownerA: string, ownerB: string, student: string, premium: string, stranger: string;
let academyA: string, academyB: string;
let resA: string; // academy A premium PDF

const rows = async (user: string | null, sql: string) => as(db, user, async () => (await db.query(sql)).rows as any[]);

beforeAll(async () => {
  db = await createDb();
  [admin, ownerA, ownerB, student, premium, stranger] = await Promise.all(
    ["admin", "ownerA", "ownerB", "student", "premium", "stranger"].map((n) => newUser(db, n)),
  );
  await db.query(`insert into platform_admins (user_id) values ($1)`, [admin]);

  academyA = (await as(db, ownerA, async () => (await db.query<{ r: string }>(`select register_academy('Academy A','academy-a') r`)).rows[0].r));
  academyB = (await as(db, ownerB, async () => (await db.query<{ r: string }>(`select register_academy('Academy B','academy-b') r`)).rows[0].r));
  await db.exec(`update academies set status='active'`); // backend/service context (no JWT) activates both
  await db.query(`insert into memberships (academy_id,user_id,role) values ($1,$2,'student')`, [academyA, student]);

  resA = (await as(db, ownerA, async () =>
    (await db.query<{ id: string }>(`insert into resources (academy_id,title,access_tier) values ($1,'Sarf Notes','premium') returning id`, [academyA])).rows[0].id));
  // Academy A premium books need an academy-scoped entitlement; platform Premium no longer covers them (see ledger-and-scope.test.ts).
  await db.query(`insert into entitlements (user_id,scope,scope_id,source) values ($1,'academy',$2,'subscription')`, [premium, academyA]);
});

describe("tenant isolation", () => {
  it("academy owner can see own pending/active academy but not edit another's", async () => {
    expect(await denied(db, ownerA, `update academies set name='Hacked' where id='${academyB}'`)).toBe(false); // RLS filters to 0 rows, no error
    const b = await db.query<{ name: string }>(`select name from academies where id=$1`, [academyB]);
    expect(b.rows[0].name).toBe("Academy B");
  });

  it("owner cannot approve own academy or change owner", async () => {
    await db.exec(`update academies set status='pending' where id='${academyA}'`);
    expect(await denied(db, ownerA, `update academies set status='active' where id='${academyA}'`)).toBe(true);
    await db.exec(`update academies set status='active' where id='${academyA}'`);
  });

  it("memberships of academy A are invisible to academy B owner", async () => {
    const r = await rows(ownerB, `select * from memberships where academy_id='${academyA}'`);
    expect(r).toHaveLength(0);
  });

  it("owner B cannot attach themself to academy A", async () => {
    expect(await denied(db, ownerB, `insert into memberships (academy_id,user_id,role) values ('${academyA}','${ownerB}','academy_admin')`)).toBe(true);
  });

  it("academy admin cannot mint another owner or admin-escalate", async () => {
    expect(await denied(db, ownerA, `insert into memberships (academy_id,user_id,role) values ('${academyA}','${stranger}','academy_owner')`)).toBe(true);
  });

  it("owner B cannot see academy A resources metadata when unpublished, or its permission record", async () => {
    expect(await rows(ownerB, `select * from resources where id='${resA}'`)).toHaveLength(0);
    expect(await rows(ownerB, `select * from copyright_permissions where resource_id='${resA}'`)).toHaveLength(0);
  });

  it("owner B cannot create resources in academy A", async () => {
    expect(await denied(db, ownerB, `insert into resources (academy_id,title) values ('${academyA}','x')`)).toBe(true);
  });

  it("anonymous users cannot read memberships, profiles, entitlements", async () => {
    expect(await denied(db, null, `select * from memberships`)).toBe(true);
    expect(await denied(db, null, `select * from entitlements`)).toBe(true);
  });

  it("users cannot read other users' profiles or entitlements", async () => {
    expect((await rows(stranger, `select * from profiles`)).map((p) => p.id)).toEqual([stranger]);
    expect(await rows(stranger, `select * from entitlements`)).toHaveLength(0);
  });

  it("users cannot grant themselves entitlements", async () => {
    expect(await denied(db, stranger, `insert into entitlements (user_id,scope,scope_id,source) values ('${stranger}','platform',null,'manual_grant')`)).toBe(true);
  });

  it("only super admins write the catalog", async () => {
    expect(await denied(db, ownerA, `insert into boards (slug,name_en) values ('x','X')`)).toBe(true);
    expect(await denied(db, admin, `insert into boards (slug,name_en,status) values ('wifaq','Wifaq-ul-Madaris','published')`)).toBe(false);
  });
});

describe("copyright permission rules", () => {
  it("new resources start fully restricted", async () => {
    const p = (await db.query<any>(`select * from copyright_permissions where resource_id=$1`, [resA])).rows[0];
    expect(p).toMatchObject({ permission_status: "not_reviewed", allow_online_view: false, allow_download: false, allow_commercial: false });
  });

  it("cannot publish without approved permission", async () => {
    expect(await denied(db, ownerA, `update resources set status='published' where id='${resA}'`)).toBe(true);
  });

  it("academy staff cannot self-approve or flip grant flags", async () => {
    expect(await denied(db, ownerA, `update copyright_permissions set permission_status='approved' where resource_id='${resA}'`)).toBe(true);
    await as(db, ownerA, async () => { await db.exec(`update copyright_permissions set allow_download=true where resource_id='${resA}'`); });
    expect((await db.query<any>(`select allow_download from copyright_permissions where resource_id=$1`, [resA])).rows[0].allow_download).toBe(false); // cleared, never granted
    expect(await denied(db, ownerA, `update copyright_permissions set permission_status='pending_verification', license_type='explicit_permission', evidence_reference='Letter from publisher, 2026-10-01' where resource_id='${resA}'`)).toBe(false);
  });

  it("database rejects grants on a non-approved record and approvals without evidence", async () => {
    await db.exec(`update copyright_permissions set allow_online_view=true where resource_id='${resA}'`);
    expect((await db.query<any>(`select allow_online_view from copyright_permissions where resource_id=$1`, [resA])).rows[0].allow_online_view).toBe(false); // non-approved records can never hold grants
    await db.exec(`update copyright_permissions set evidence_reference=null where resource_id='${resA}'`);
    expect(await denied(db, admin, `update copyright_permissions set permission_status='approved' where resource_id='${resA}'`)).toBe(true);
    await db.exec(`update copyright_permissions set evidence_reference='Letter from publisher, 2026-10-01' where resource_id='${resA}'`);
  });

  it("super admin approves; verifier is stamped server-side", async () => {
    await as(db, admin, async () => {
      await db.exec(`update copyright_permissions set permission_status='approved', allow_online_view=true, allow_commercial=true where resource_id='${resA}'`);
    });
    const p = (await db.query<any>(`select verified_by, verified_at from copyright_permissions where resource_id=$1`, [resA])).rows[0];
    expect(p.verified_by).toBe(admin);
    expect(p.verified_at).not.toBeNull();
  });

  it("audit log records permission changes and is append-only for clients", async () => {
    const n = (await db.query<any>(`select count(*)::int c from audit_logs where entity_type='resource'`)).rows[0].c;
    expect(n).toBeGreaterThan(1);
    expect(await denied(db, admin, `delete from audit_logs`)).toBe(true);
    expect(await denied(db, admin, `insert into audit_logs (action, entity_type) values ('x','y')`)).toBe(true);
  });
});

describe("resource access (entitlement x copyright)", () => {
  const can = (user: string | null, purpose: string) =>
    as(db, user, async () => (await db.query<{ ok: boolean }>(`select can_access_resource($1,$2) ok`, [resA, purpose])).rows[0].ok);

  it("publishes after approval", async () => {
    await as(db, ownerA, async () => { await db.exec(`update resources set status='published' where id='${resA}'`); });
  });

  it("premium subscriber may view; free student and strangers may not", async () => {
    expect(await can(premium, "view")).toBe(true);
    expect(await can(student, "view")).toBe(false);
    expect(await can(stranger, "view")).toBe(false);
    expect(await can(null, "view")).toBe(false);
  });

  it("download stays disabled until separately authorized, even for premium", async () => {
    expect(await can(premium, "download")).toBe(false);
  });

  it("per-resource and academy entitlements work", async () => {
    await db.query(`insert into entitlements (user_id,scope,scope_id,source) values ($1,'resource',$2,'purchase')`, [stranger, resA]);
    expect(await can(stranger, "view")).toBe(true);
    await db.query(`update entitlements set revoked_at=now() where user_id=$1`, [stranger]);
    expect(await can(stranger, "view")).toBe(false);
  });

  it("expired entitlements stop working", async () => {
    await db.query(`insert into entitlements (user_id,scope,scope_id,source,starts_at,expires_at) values ($1,'platform',null,'trial', now()-interval '2 days', now()-interval '1 day')`, [stranger]);
    expect(await can(stranger, "view")).toBe(false);
  });

  it("commercial permission is required for premium: premium never overrides copyright", async () => {
    await db.exec(`update copyright_permissions set allow_commercial=false where resource_id='${resA}'`);
    expect(await can(premium, "view")).toBe(false);
    await db.exec(`update copyright_permissions set allow_commercial=true where resource_id='${resA}'`);
    expect(await can(premium, "view")).toBe(true);
  });

  it("expired permission disables access automatically", async () => {
    await db.exec(`update copyright_permissions set expires_at=now()-interval '1 minute' where resource_id='${resA}'`);
    expect(await can(premium, "view")).toBe(false);
    await db.exec(`update copyright_permissions set expires_at=null where resource_id='${resA}'`);
    expect(await can(premium, "view")).toBe(true);
  });

  it("revoked permission (rejected/removed) disables access", async () => {
    await db.exec(`update copyright_permissions set permission_status='removed' where resource_id='${resA}'`);
    expect(await can(premium, "view")).toBe(false);
  });

  it("suspended academy content is inaccessible", async () => {
    await db.exec(`update copyright_permissions set permission_status='approved', allow_online_view=true, allow_commercial=true where resource_id='${resA}'`);
    expect(await can(premium, "view")).toBe(true);
    await db.exec(`update academies set status='suspended' where id='${academyA}'`);
    expect(await can(premium, "view")).toBe(false);
    await db.exec(`update academies set status='active' where id='${academyA}'`);
  });

  it("staff can 'review' own academy's file but another academy's staff cannot", async () => {
    expect(await can(ownerA, "review")).toBe(true);
    expect(await can(ownerB, "review")).toBe(false);
    expect(await can(admin, "review")).toBe(true);
  });
});

describe("storage: direct file URLs honour the same rules", () => {
  it("premium user reads the object row; free user and anon do not", async () => {
    await db.exec(`insert into storage.objects (bucket_id,name) values ('resources-private','${resA}/book.pdf')`);
    const q = `select name from storage.objects where bucket_id='resources-private'`;
    expect(await rows(premium, q)).toHaveLength(1);
    expect(await rows(student, q)).toHaveLength(0);
    expect(await rows(null, q)).toHaveLength(0);
  });

  it("other academy's staff cannot upload into this resource's folder", async () => {
    expect(await denied(db, ownerB, `insert into storage.objects (bucket_id,name) values ('resources-private','${resA}/evil.pdf')`)).toBe(true);
    expect(await denied(db, ownerA, `insert into storage.objects (bucket_id,name) values ('resources-private','${resA}/ok.pdf')`)).toBe(false);
  });
});


describe("insert-time publishing bypass (migration 5)", () => {
  const ins = (status: string, academy = academyA) =>
    `insert into resources (academy_id,title,status) values ('${academy}','Bypass ${status}','${status}')`;
  const publicCount = async () => (await rows(null, `select * from resources where title like 'Bypass%'`)).length;

  it("academy staff cannot insert a resource as published, in_review or archived", async () => {
    for (const s of ["published", "in_review", "archived"]) expect(await denied(db, ownerA, ins(s))).toBe(true);
    expect(await publicCount()).toBe(0); // nothing leaked to the public listing
  });

  it("academy staff can still insert drafts, which stay hidden from the public", async () => {
    expect(await denied(db, ownerA, ins("draft"))).toBe(false);
    expect(await publicCount()).toBe(0);
  });

  it("a super admin may insert a non-draft resource", async () => {
    expect(await denied(db, admin, `insert into resources (title,status) values ('Bypass admin','in_review')`)).toBe(false);
  });

  it("the backend (no JWT) may insert a non-draft resource", async () => {
    await db.exec(`insert into resources (academy_id,title,status) values ('${academyA}','Bypass backend','in_review')`);
  });

  it("publishing a draft by update is still blocked without approval", async () => {
    const id = (await db.query<{ id: string }>(`select id from resources where title='Bypass draft'`)).rows[0].id;
    expect(await denied(db, ownerA, `update resources set status='published' where id='${id}'`)).toBe(true);
  });
});
