import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let ownerA: string, ownerB: string, student: string, nameless: string;
let course: string, l1: string, l2: string, quiz: string, optRight: string, optWrong: string, qid: string;
let code: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) => as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};
const status = async (user: string) => (await q(user, `select certificate_status($1) r`, [course]))[0].r;

beforeAll(async () => {
  db = await createDb();
  [ownerA, ownerB, student, nameless] = await Promise.all(["ownerA", "ownerB", "student", "nameless"].map((n) => newUser(db, n)));
  await db.exec(`update profiles set full_name = 'Amina Khan' where id = '${student}'`);
  await db.exec(`update profiles set full_name = null where id = '${nameless}'`);
  const academyA = (await q(ownerA, `select register_academy('Academy A','academy-a') r`))[0].r;
  await q(ownerB, `select register_academy('Academy B','academy-b') r`);
  await db.exec(`update academies set status='active'`);
  course = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'sarf','Sarf',$2) returning id`, [academyA, ownerA]))[0].id;
  const mod = (await q(ownerA, `insert into course_modules (course_id,title) values ($1,'Unit') returning id`, [course]))[0].id;
  l1 = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'One',1) returning id`, [course, mod]))[0].id;
  l2 = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'Two',2) returning id`, [course, mod]))[0].id;
  quiz = (await q(ownerA, `insert into quizzes (lesson_id,title,pass_percent) values ($1,'Check',100) returning id`, [l2]))[0].id;
  qid = (await q(ownerA, `insert into quiz_questions (quiz_id,prompt,position) values ($1,'Pick',1) returning id`, [quiz]))[0].id;
  optRight = (await q(ownerA, `insert into quiz_options (question_id,label,is_correct,position) values ($1,'Right',true,1) returning id`, [qid]))[0].id;
  optWrong = (await q(ownerA, `insert into quiz_options (question_id,label,is_correct,position) values ($1,'Wrong',false,2) returning id`, [qid]))[0].id;
  await db.exec(`update courses set status='published' where id='${course}'`);
  await q(student, `select enroll_in_course($1)`, [course]);
  await q(nameless, `select enroll_in_course($1)`, [course]);
});

describe("earning it", () => {
  it("is not available before the work is done", async () => {
    expect((await status(student)).reason).toMatch(/every lesson/);
    expect(await failure(student, `select claim_certificate($1)`, [course])).toMatch(/every lesson/);
    expect((await status(ownerB)).reason).toMatch(/Enroll/);
    expect(await failure(ownerB, `select claim_certificate($1)`, [course])).toMatch(/Enroll/);
  });
  it("needs every quiz passed as well", async () => {
    await q(student, `select complete_lesson($1)`, [l1]);
    await q(student, `select complete_lesson($1)`, [l2]);
    expect((await status(student)).reason).toMatch(/every quiz/);
    await q(student, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, JSON.stringify({ [qid]: optWrong })]);
    expect((await status(student)).eligible).toBe(false);
    await q(student, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, JSON.stringify({ [qid]: optRight })]);
    expect(await status(student)).toMatchObject({ eligible: true, issued: false });
  });
  it("needs a real name on the profile", async () => {
    await q(nameless, `select complete_lesson($1)`, [l1]);
    await q(nameless, `select complete_lesson($1)`, [l2]);
    await q(nameless, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, JSON.stringify({ [qid]: optRight })]);
    expect(await failure(nameless, `select claim_certificate($1)`, [course])).toMatch(/full name/);
  });
  it("issues once, with a snapshot, and returns the same code again", async () => {
    code = (await q(student, `select claim_certificate($1) r`, [course]))[0].r;
    expect(code).toMatch(/^[A-Z0-9]{12}$/);
    expect((await q(student, `select claim_certificate($1) r`, [course]))[0].r).toBe(code);
    expect(await status(student)).toMatchObject({ issued: true, code });
    await db.exec(`update profiles set full_name = 'Changed Later' where id = '${student}'`);
    const v = (await q(null, `select verify_certificate($1) r`, [code.toLowerCase()]))[0].r;
    expect(v).toMatchObject({ name: "Amina Khan", course: "Sarf", academy: "Academy A" });
    expect(JSON.stringify(v)).not.toMatch(/user_id|email/);
  });
});

describe("access and withdrawal", () => {
  it("clients cannot write the table; only the owner and staff read rows", async () => {
    expect(await failure(student, `update certificates set recipient_name='Hacker Name'`)).toMatch(/permission denied/);
    expect(await q(student, `select 1 from certificates`)).toHaveLength(1);
    expect(await q(ownerA, `select 1 from certificates`)).toHaveLength(1);
    expect(await q(ownerB, `select 1 from certificates`)).toHaveLength(0);
    expect((await q(null, `select verify_certificate('NOSUCHCODE12') r`))[0].r).toBeNull();
  });
  it("only that academy's staff withdraw it, with a reason; it then stops verifying and cannot be re-issued", async () => {
    expect(await failure(student, `select revoke_certificate($1,'self')`, [code])).toMatch(/Not found/);
    expect(await failure(ownerB, `select revoke_certificate($1,'other academy')`, [code])).toMatch(/Not found/);
    expect(await failure(ownerA, `select revoke_certificate($1,'')`, [code])).toMatch(/reason/);
    await q(ownerA, `select revoke_certificate($1,'Cheating found')`, [code]);
    expect((await q(null, `select verify_certificate($1) r`, [code]))[0].r).toBeNull();
    expect(await failure(student, `select claim_certificate($1)`, [course])).toMatch(/withdrawn/);
    const audit = await db.query(`select action from audit_logs where action like 'certificate.%' order by created_at`);
    expect((audit.rows as any[]).map((r) => r.action)).toEqual(["certificate.issued", "certificate.revoked"]);
  });
});
