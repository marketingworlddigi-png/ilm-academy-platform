import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let ownerA: string, teacherA: string, ownerB: string, student: string, other: string, outsider: string;
let course: string, lesson: string, assignment: string, submission: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) => as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};

beforeAll(async () => {
  db = await createDb();
  [ownerA, teacherA, ownerB, student, other, outsider] = await Promise.all(["ownerA", "teacherA", "ownerB", "student", "other", "outsider"].map((n) => newUser(db, n)));
  await db.exec(`update profiles set full_name = 'Amina Khan' where id = '${student}'`);
  const academyA = (await q(ownerA, `select register_academy('Academy A','academy-a') r`))[0].r;
  await q(ownerB, `select register_academy('Academy B','academy-b') r`);
  await db.exec(`update academies set status='active'`);
  await db.query(`insert into memberships (academy_id,user_id,role) values ($1,$2,'instructor')`, [academyA, teacherA]);
  course = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'sarf','Sarf',$2) returning id`, [academyA, ownerA]))[0].id;
  const mod = (await q(ownerA, `insert into course_modules (course_id,title) values ($1,'Unit') returning id`, [course]))[0].id;
  lesson = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'Paid',1) returning id`, [course, mod]))[0].id;
  await db.exec(`update courses set status='published' where id='${course}'`);
  await q(student, `select enroll_in_course($1)`, [course]);
  await q(other, `select enroll_in_course($1)`, [course]);
});

describe("writing the assignment", () => {
  it("teachers create it; learners and other academies cannot", async () => {
    assignment = (await q(teacherA, `insert into assignments (lesson_id,title,instructions,max_points) values ($1,'Conjugate','Write ten verbs.',20) returning id`, [lesson]))[0].id;
    expect(await failure(student, `insert into assignments (lesson_id,title,instructions) values ($1,'Mine','Hack')`, [lesson])).toMatch(/permission denied|row-level security|duplicate/);
    expect(await failure(ownerB, `update assignments set title='Stolen' where id=$1 returning id`, [assignment])).toBeNull();
    expect((await q(teacherA, `select title from assignments where id=$1`, [assignment]))[0].title).toBe("Conjugate");
  });
});

describe("handing in", () => {
  it("enrolled learners see the assignment and hand in; outsiders cannot", async () => {
    const g = (await q(student, `select get_assignment($1) r`, [lesson]))[0].r;
    expect(g).toMatchObject({ title: "Conjugate", max_points: 20, can_submit: true, submission: null });
    expect((await q(outsider, `select get_assignment($1) r`, [lesson]))[0].r).toBeNull();
    expect(await failure(outsider, `select submit_assignment($1,'Let me in')`, [assignment])).toMatch(/Enroll/);
    await q(student, `select submit_assignment($1,'  First try  ')`, [assignment]);
    await q(student, `select submit_assignment($1,'Second try')`, [assignment]);
    const s = (await q(student, `select get_assignment($1) r`, [lesson]))[0].r.submission;
    expect(s).toMatchObject({ body: "Second try", score: null });
  });
  it("validates the text and blocks direct writes", async () => {
    expect(await failure(student, `select submit_assignment($1,' ')`, [assignment])).toMatch(/Write your answer/);
    expect(await failure(student, `select submit_assignment($1,$2)`, [assignment, "x".repeat(5001)])).toMatch(/under 5000/);
    expect(await failure(student, `insert into assignment_submissions (assignment_id,course_id,user_id,body) values ('${assignment}','${course}','${student}','direct')`)).toMatch(/permission denied/);
  });
  it("learners only read their own work", async () => {
    await q(other, `select submit_assignment($1,'Other work')`, [assignment]);
    const rows = await q(student, `select body from assignment_submissions`);
    expect(rows.map((r) => r.body)).toEqual(["Second try"]);
    expect(await q(ownerB, `select 1 from assignment_submissions`)).toHaveLength(0);
  });
});

describe("marking", () => {
  it("only the academy's teachers list and mark; names are first names", async () => {
    expect((await q(student, `select list_submissions($1) r`, [assignment]))[0].r).toBeNull();
    expect((await q(ownerB, `select list_submissions($1) r`, [assignment]))[0].r).toBeNull();
    const list = (await q(teacherA, `select list_submissions($1) r`, [assignment]))[0].r;
    expect(list).toHaveLength(2);
    expect(JSON.stringify(list)).not.toMatch(/Khan|user_id/);
    submission = list.find((x: any) => x.author === "Amina").id;
    expect(await failure(student, `select grade_submission($1,10,'self')`, [submission])).toMatch(/Not found/);
    expect(await failure(ownerB, `select grade_submission($1,10,'x')`, [submission])).toMatch(/Not found/);
    expect(await failure(teacherA, `select grade_submission($1,21,'x')`, [submission])).toMatch(/between 0 and 20/);
    await q(teacherA, `select grade_submission($1,17,'  Good work  ')`, [submission]);
    const s = (await q(student, `select get_assignment($1) r`, [lesson]))[0].r.submission;
    expect(s).toMatchObject({ score: 17, feedback: "Good work" });
    const audit = await db.query(`select action from audit_logs where action = 'assignment.graded'`);
    expect(audit.rows).toHaveLength(1);
  });
  it("marked work can no longer be replaced", async () => {
    expect(await failure(student, `select submit_assignment($1,'Change it')`, [assignment])).toMatch(/can no longer be changed/);
  });
});
