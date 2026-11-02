import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let admin: string, ownerA: string, ownerB: string, student: string, stranger: string;
let academyA: string, academyB: string;
let course: string, mod: string, lessonPreview: string, lessonPaid: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) =>
  as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};
const ids = async (user: string | null, sql: string, params: unknown[] = []) => (await q(user, sql, params)).map((r) => r.id);

beforeAll(async () => {
  db = await createDb();
  [admin, ownerA, ownerB, student, stranger] = await Promise.all(["admin", "ownerA", "ownerB", "student", "stranger"].map((n) => newUser(db, n)));
  await db.query(`insert into platform_admins (user_id) values ($1)`, [admin]);
  academyA = (await q(ownerA, `select register_academy('Academy A','academy-a') r`))[0].r;
  academyB = (await q(ownerB, `select register_academy('Academy B','academy-b') r`))[0].r;
  await db.exec(`update academies set status='active'`);

  course = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'sarf-basics','Sarf Basics',$2) returning id`, [academyA, ownerA]))[0].id;
  mod = (await q(ownerA, `insert into course_modules (course_id,title,position) values ($1,'Unit 1',1) returning id`, [course]))[0].id;
  lessonPreview = (await q(ownerA, `insert into lessons (course_id,module_id,title,body,is_preview,position) values ($1,$2,'Welcome','Free intro text',true,1) returning id`, [course, mod]))[0].id;
  lessonPaid = (await q(ownerA, `insert into lessons (course_id,module_id,title,body,position) values ($1,$2,'Lesson Two','Members only text',2) returning id`, [course, mod]))[0].id;
});

describe("authoring", () => {
  it("staff of the academy create courses; other academies and strangers cannot", async () => {
    expect(await failure(ownerB, `insert into courses (academy_id,slug,title,created_by) values ('${academyA}','x-course','X Course','${ownerB}')`)).toMatch(/row-level security/);
    expect(await failure(stranger, `insert into courses (academy_id,slug,title,created_by) values ('${academyA}','y-course','Y Course','${stranger}')`)).toMatch(/row-level security/);
    expect(await failure(null, `insert into courses (academy_id,slug,title) values ('${academyA}','z-course','Z Course')`)).toMatch(/permission denied/);
  });

  it("a course always starts as a draft", async () => {
    expect(await failure(ownerA, `insert into courses (academy_id,slug,title,created_by,status) values ('${academyA}','pub-now','Pub Now','${ownerA}','published')`)).toMatch(/starts as a draft/);
  });

  it("other academies cannot edit or add lessons", async () => {
    expect(await q(ownerB, `update courses set title='Hacked Title' where id=$1 returning id`, [course])).toHaveLength(0);
    expect(await failure(ownerB, `insert into lessons (course_id,module_id,title) values ('${course}','${mod}','Injected')`)).toMatch(/row-level security/);
  });

  it("slugs are unique per academy but reusable across academies", async () => {
    expect(await failure(ownerA, `insert into courses (academy_id,slug,title,created_by) values ('${academyA}','sarf-basics','Again','${ownerA}')`)).toMatch(/duplicate key|unique/);
    await q(ownerB, `insert into courses (academy_id,slug,title,created_by) values ($1,'sarf-basics','Sarf Basics B',$2)`, [academyB, ownerB]);
  });

  it("a lesson's module must belong to the same course", async () => {
    const other = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'other-course','Other Course',$2) returning id`, [academyA, ownerA]))[0].id;
    expect(await failure(ownerA, `insert into lessons (course_id,module_id,title) values ('${other}','${mod}','Wrong module')`)).toMatch(/does not belong/);
    expect(await failure(ownerA, `update lessons set course_id='${other}' where id='${lessonPaid}'`)).toMatch(/cannot move/);
  });

  it("a course cannot move academies", async () => {
    expect(await failure(ownerA, `update courses set academy_id='${academyB}' where id='${course}'`)).toMatch(/cannot move|row-level security/);
  });
});

describe("drafts are private", () => {
  it("only staff and super admins see a draft course, its modules and lessons", async () => {
    for (const u of [null, student, stranger, ownerB]) {
      expect(await q(u, `select id from courses where id=$1`, [course])).toHaveLength(0);
      expect(await q(u, `select id from course_modules where course_id=$1`, [course])).toHaveLength(0);
      expect(await q(u, `select id from lessons where course_id=$1`, [course])).toHaveLength(0);
      expect(await q(u, `select * from course_outline($1)`, [course])).toHaveLength(0);
    }
    expect(await q(ownerA, `select id from lessons where course_id=$1`, [course])).toHaveLength(2);
    expect(await q(admin, `select id from courses where id=$1`, [course])).toHaveLength(1);
  });

  it("cannot be enrolled in", async () => {
    expect(await failure(student, `select enroll_in_course($1)`, [course])).toMatch(/not found/);
  });
});

describe("publishing", () => {
  it("needs at least one lesson", async () => {
    const empty = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'empty-one','Empty One',$2) returning id`, [academyA, ownerA]))[0].id;
    expect(await failure(ownerA, `update courses set status='published' where id=$1`, [empty])).toMatch(/at least one lesson/);
  });

  it("needs an approved academy", async () => {
    await db.exec(`update academies set status='pending' where id='${academyA}'`);
    expect(await failure(ownerA, `update courses set status='published' where id='${course}'`)).toMatch(/approved/);
    await db.exec(`update academies set status='active' where id='${academyA}'`);
  });

  it("publishing is audited and stamps the date", async () => {
    await q(ownerA, `update courses set status='published' where id=$1`, [course]);
    expect((await db.query<any>(`select published_at from courses where id=$1`, [course])).rows[0].published_at).not.toBeNull();
    expect((await db.query(`select 1 from audit_logs where action='course.published' and entity_id=$1`, [course])).rows).toHaveLength(1);
  });

  it("a published course keeps its last lesson and its web address", async () => {
    const solo = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'solo-one','Solo One',$2) returning id`, [academyA, ownerA]))[0].id;
    const m = (await q(ownerA, `insert into course_modules (course_id,title) values ($1,'Only module') returning id`, [solo]))[0].id;
    const l = (await q(ownerA, `insert into lessons (course_id,module_id,title) values ($1,$2,'Only lesson') returning id`, [solo, m]))[0].id;
    await q(ownerA, `update courses set status='published' where id=$1`, [solo]);
    expect(await failure(ownerA, `delete from lessons where id=$1`, [l])).toMatch(/at least one lesson/);
    expect(await failure(ownerA, `update courses set slug='renamed-one' where id=$1`, [solo])).toMatch(/Unpublish/);
  });
});

describe("a published course", () => {
  it("is public with its modules and an outline of titles, but not lesson content", async () => {
    expect(await q(null, `select id from courses where id=$1`, [course])).toHaveLength(1);
    expect(await q(null, `select id from course_modules where course_id=$1`, [course])).toHaveLength(1);
    const outline = await q(null, `select title, is_preview from course_outline($1) order by lesson_position`, [course]);
    expect(outline).toEqual([{ title: "Welcome", is_preview: true }, { title: "Lesson Two", is_preview: false }]);
    expect(Object.keys(outline[0])).not.toContain("body");
  });

  it("shows only preview lessons to people who are not enrolled", async () => {
    for (const u of [null, student, stranger, ownerB]) {
      expect(await ids(u, `select id from lessons where course_id=$1`, [course])).toEqual([lessonPreview]);
    }
  });

  it("anonymous visitors cannot enroll; signed-in users can, once (idempotent)", async () => {
    expect(await failure(null, `select enroll_in_course($1)`, [course])).toMatch(/permission denied/);
    const a = (await q(student, `select enroll_in_course($1) id`, [course]))[0].id;
    const b = (await q(student, `select enroll_in_course($1) id`, [course]))[0].id;
    expect(a).toBe(b);
    expect((await db.query(`select 1 from enrollments where course_id=$1 and user_id=$2`, [course, student])).rows).toHaveLength(1);
  });

  it("enrolled users read every lesson; others still do not", async () => {
    expect((await ids(student, `select id from lessons where course_id=$1`, [course])).sort()).toEqual([lessonPreview, lessonPaid].sort());
    expect(await ids(stranger, `select id from lessons where course_id=$1`, [course])).toEqual([lessonPreview]);
  });

  it("enrollments cannot be written or read across users", async () => {
    expect(await failure(stranger, `insert into enrollments (course_id,user_id) values ('${course}','${stranger}')`)).toMatch(/permission denied/);
    expect(await failure(student, `update enrollments set status='active' where user_id='${student}'`)).toMatch(/permission denied/);
    expect(await q(stranger, `select 1 from enrollments`)).toHaveLength(0);
    expect(await q(student, `select 1 from enrollments`)).toHaveLength(1);
    expect(await q(ownerA, `select 1 from enrollments where course_id=$1`, [course])).toHaveLength(1); // academy staff see their roster
    expect(await q(ownerB, `select 1 from enrollments`)).toHaveLength(0);
  });

  it("leaving closes access; re-enrolling restores it; removal by the academy is final", async () => {
    await q(student, `select leave_course($1)`, [course]);
    expect(await ids(student, `select id from lessons where course_id=$1`, [course])).toEqual([lessonPreview]);
    await q(student, `select enroll_in_course($1)`, [course]);
    expect(await ids(student, `select id from lessons where course_id=$1`, [course])).toHaveLength(2);
    await db.exec(`update enrollments set status='removed' where user_id='${student}'`);
    expect(await failure(student, `select enroll_in_course($1)`, [course])).toMatch(/cannot enroll/);
    expect(await ids(student, `select id from lessons where course_id=$1`, [course])).toEqual([lessonPreview]);
    await db.exec(`update enrollments set status='active' where user_id='${student}'`);
  });

  it("disappears when unpublished, archived, or when the academy is suspended; enrollment stops working", async () => {
    await q(ownerA, `update courses set status='archived' where id=$1`, [course]);
    expect(await q(null, `select id from courses where id=$1`, [course])).toHaveLength(0);
    expect(await ids(student, `select id from lessons where course_id=$1`, [course])).toHaveLength(0);
    await q(ownerA, `update courses set status='published' where id=$1`, [course]);
    expect(await ids(student, `select id from lessons where course_id=$1`, [course])).toHaveLength(2);
    await db.exec(`update academies set status='suspended' where id='${academyA}'`);
    expect(await q(null, `select id from courses where id=$1`, [course])).toHaveLength(0);
    expect(await ids(student, `select id from lessons where course_id=$1`, [course])).toHaveLength(0);
    expect(await failure(stranger, `select enroll_in_course($1)`, [course])).toMatch(/not found/);
    await db.exec(`update academies set status='active' where id='${academyA}'`);
  });
});

describe("linked library books", () => {
  it("a lesson may link a platform book or the academy's own book, never another academy's", async () => {
    const platformBook = (await q(admin, `insert into resources (title) values ('Platform book') returning id`))[0].id;
    const ownBook = (await q(ownerA, `insert into resources (academy_id,title) values ($1,'Own book') returning id`, [academyA]))[0].id;
    const foreignBook = (await q(ownerB, `insert into resources (academy_id,title) values ($1,'Foreign book') returning id`, [academyB]))[0].id;
    await q(ownerA, `update lessons set resource_id=$1 where id=$2`, [platformBook, lessonPaid]);
    await q(ownerA, `update lessons set resource_id=$1 where id=$2`, [ownBook, lessonPaid]);
    expect(await failure(ownerA, `update lessons set resource_id=$1 where id=$2`, [foreignBook, lessonPaid])).toMatch(/cannot be linked/);
  });
});
