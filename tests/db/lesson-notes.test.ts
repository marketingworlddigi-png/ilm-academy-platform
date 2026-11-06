import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let ownerA: string, student: string, outsider: string;
let lessonPaid: string, lessonPreview: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) => as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};

beforeAll(async () => {
  db = await createDb();
  [ownerA, student, outsider] = await Promise.all(["ownerA", "student", "outsider"].map((n) => newUser(db, n)));
  const academyA = (await q(ownerA, `select register_academy('Academy A','academy-a') r`))[0].r;
  await db.exec(`update academies set status='active'`);
  const course = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'sarf','Sarf',$2) returning id`, [academyA, ownerA]))[0].id;
  const mod = (await q(ownerA, `insert into course_modules (course_id,title) values ($1,'Unit') returning id`, [course]))[0].id;
  lessonPaid = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'Paid',1) returning id`, [course, mod]))[0].id;
  lessonPreview = (await q(ownerA, `insert into lessons (course_id,module_id,title,is_preview,position) values ($1,$2,'Preview',true,2) returning id`, [course, mod]))[0].id;
  await db.exec(`update courses set status='published' where id='${course}'`);
  await q(student, `select enroll_in_course($1)`, [course]);
});

describe("lesson notes", () => {
  it("enrolled learners write, update and read their own note", async () => {
    await q(student, `insert into lesson_notes (user_id,lesson_id,body) values ($1,$2,'first')`, [student, lessonPaid]);
    await q(student, `update lesson_notes set body='second' where lesson_id=$1`, [lessonPaid]);
    expect((await q(student, `select body from lesson_notes`)).map((r) => r.body)).toEqual(["second"]);
  });
  it("nobody else reads it, not even the academy owner", async () => {
    expect(await q(ownerA, `select 1 from lesson_notes`)).toHaveLength(0);
    expect(await q(outsider, `select 1 from lesson_notes`)).toHaveLength(0);
  });
  it("cannot write for someone else or for a lesson you cannot open", async () => {
    expect(await failure(outsider, `insert into lesson_notes (user_id,lesson_id,body) values ($1,$2,'x')`, [outsider, lessonPaid])).toMatch(/row-level security/);
    expect(await failure(student, `insert into lesson_notes (user_id,lesson_id,body) values ($1,$2,'x')`, [outsider, lessonPreview])).toMatch(/row-level security/);
    await q(outsider, `insert into lesson_notes (user_id,lesson_id,body) values ($1,$2,'preview note')`, [outsider, lessonPreview]);
    expect(await q(outsider, `select 1 from lesson_notes`)).toHaveLength(1);
  });
  it("limits the length and allows deleting", async () => {
    expect(await failure(student, `update lesson_notes set body=$1`, ["x".repeat(5001)])).toMatch(/check constraint/);
    await q(student, `delete from lesson_notes where lesson_id=$1`, [lessonPaid]);
    expect(await q(student, `select 1 from lesson_notes`)).toHaveLength(0);
  });
});
