import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, denied, newUser, type Db } from "./harness";

let db: Db;
let admin: string, owner: string;
let board: string, level: string, subject: string, subject2: string, academy: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) =>
  as(db, user, async () => (await db.query(sql, params)).rows as any[]);

beforeAll(async () => {
  db = await createDb();
  [admin, owner] = await Promise.all([newUser(db, "admin"), newUser(db, "owner")]);
  await db.query(`insert into platform_admins (user_id) values ($1)`, [admin]);
  academy = (await as(db, owner, async () => (await db.query<{ r: string }>(`select register_academy('Academy One','academy-one') r`)).rows[0].r));
  await db.exec(`update academies set status='active'`);
  board = (await q(admin, `insert into boards (slug,name_en,status) values ('b','Board','published') returning id`))[0].id;
  level = (await q(admin, `insert into levels (board_id,slug,name_en) values ($1,'y1','Year 1') returning id`, [board]))[0].id;
  [subject, subject2] = [
    (await q(admin, `insert into subjects (slug,name_en,status) values ('nahw','Nahw','published') returning id`))[0].id,
    (await q(admin, `insert into subjects (slug,name_en,status) values ('sarf','Sarf','published') returning id`))[0].id,
  ];
  await q(admin, `insert into level_subjects (level_id,subject_id) values ($1,$2),($1,$3)`, [level, subject, subject2]);
});

describe("catalog admin rules", () => {
  it("RLS filters non-admin updates/deletes silently (0 rows), so the app must check the returned rows", async () => {
    expect(await q(owner, `update boards set name_en='Hacked' where id=$1 returning id`, [board])).toHaveLength(0);
    expect(await q(owner, `delete from levels where id=$1 returning id`, [level])).toHaveLength(0);
    expect(await q(owner, `delete from subjects where id=$1 returning id`, [subject])).toHaveLength(0);
    expect((await db.query<any>(`select name_en from boards where id=$1`, [board])).rows[0].name_en).toBe("Board");
  });

  it("non-admins cannot change level-subject links", async () => {
    expect(await denied(db, owner, `insert into level_subjects (level_id,subject_id) values ('${level}','${subject}')`)).toBe(true);
    expect(await q(owner, `delete from level_subjects where level_id=$1 returning level_id`, [level])).toHaveLength(0);
  });

  it("a duplicate slug is rejected with 23505", async () => {
    await expect(q(admin, `insert into boards (slug,name_en) values ('b','Other')`)).rejects.toMatchObject({ code: "23505" });
    await expect(q(admin, `insert into levels (board_id,slug,name_en) values ($1,'y1','Dup')`, [board])).rejects.toMatchObject({ code: "23505" });
  });

  it("the same level slug is allowed in a different board", async () => {
    const b2 = (await q(admin, `insert into boards (slug,name_en) values ('b2','Board 2') returning id`))[0].id;
    expect(await q(admin, `insert into levels (board_id,slug,name_en) values ($1,'y1','Year 1') returning id`, [b2])).toHaveLength(1);
  });

  it("a board that still has levels cannot be deleted (23503)", async () => {
    // levels.board_id is ON DELETE RESTRICT, which Postgres reports as 23001 (not 23503).
    await expect(q(admin, `delete from boards where id=$1`, [board])).rejects.toMatchObject({ code: "23001" });
  });

  it("a subject used by a resource cannot be deleted; an unused one can", async () => {
    await q(admin, `insert into resources (academy_id,title,subject_id) values ($1,'Book',$2)`, [academy, subject]);
    await expect(q(admin, `delete from subjects where id=$1`, [subject])).rejects.toMatchObject({ code: "23503" });
    const unused = (await q(admin, `insert into subjects (slug,name_en) values ('unused','Unused') returning id`))[0].id;
    expect(await q(admin, `delete from subjects where id=$1 returning id`, [unused])).toHaveLength(1);
  });

  it("deleting a level removes only its subject links, not the subjects", async () => {
    const lv = (await q(admin, `insert into levels (board_id,slug,name_en) values ($1,'tmp','Tmp') returning id`, [board]))[0].id;
    await q(admin, `insert into level_subjects (level_id,subject_id) values ($1,$2)`, [lv, subject2]);
    expect(await q(admin, `delete from levels where id=$1 returning id`, [lv])).toHaveLength(1);
    expect((await db.query<any>(`select count(*)::int c from level_subjects where level_id=$1`, [lv])).rows[0].c).toBe(0);
    expect((await db.query<any>(`select count(*)::int c from subjects where id=$1`, [subject2])).rows[0].c).toBe(1);
  });

  it("draft boards, their levels and draft subjects are hidden from anonymous visitors", async () => {
    const draft = (await q(admin, `insert into boards (slug,name_en,status) values ('d','Draft','draft') returning id`))[0].id;
    await q(admin, `insert into levels (board_id,slug,name_en) values ($1,'x','X')`, [draft]);
    await q(admin, `insert into subjects (slug,name_en) values ('hidden','Hidden')`);
    expect(await q(null, `select id from boards where id=$1`, [draft])).toHaveLength(0);
    expect(await q(null, `select id from levels where board_id=$1`, [draft])).toHaveLength(0);
    expect(await q(null, `select id from subjects where slug='hidden'`)).toHaveLength(0);
    expect(await q(null, `select id from boards where id=$1`, [board])).toHaveLength(1);
  });
});
