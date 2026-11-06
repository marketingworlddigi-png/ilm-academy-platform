import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let ownerA: string, teacherA: string, ownerB: string, student: string, other: string, outsider: string;
let course: string, lessonPaid: string, lessonPreview: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) => as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};
const qa = async (user: string | null, lesson: string) => (await q(user, `select lesson_qa($1) r`, [lesson]))[0].r;

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
  lessonPaid = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'Paid',1) returning id`, [course, mod]))[0].id;
  lessonPreview = (await q(ownerA, `insert into lessons (course_id,module_id,title,is_preview,position) values ($1,$2,'Preview',true,2) returning id`, [course, mod]))[0].id;
  await db.exec(`update courses set status='published' where id='${course}'`);
  await q(student, `select enroll_in_course($1)`, [course]);
  await q(other, `select enroll_in_course($1)`, [course]);
});

describe("asking and answering", () => {
  it("enrolled learners can ask; the name is a first-name snapshot, never the full profile", async () => {
    await q(student, `select ask_question($1,'  How do I conjugate this verb?  ')`, [lessonPaid]);
    const r = await qa(student, lessonPaid);
    expect(r.can_post).toBe(true);
    expect(r.can_moderate).toBe(false);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ author: "Amina", body: "How do I conjugate this verb?", mine: true });
    expect(JSON.stringify(r)).not.toMatch(/Khan|user_id/);
  });
  it("non-enrolled people cannot post, even on a preview lesson", async () => {
    expect(await failure(outsider, `select ask_question($1,'Can I ask?')`, [lessonPreview])).toMatch(/Enroll/);
    expect(await failure(ownerB, `select ask_question($1,'Cross academy?')`, [lessonPaid])).toMatch(/Enroll/);
    expect(await failure(null, `select ask_question('${lessonPaid}','Guest?')`)).toMatch(/permission denied/);
  });
  it("a preview lesson's discussion is readable by a signed-in outsider but not postable; paid lessons are closed to them", async () => {
    await q(student, `select ask_question($1,'Question on the preview')`, [lessonPreview]);
    const r = await qa(outsider, lessonPreview);
    expect(r).toMatchObject({ can_post: false, can_moderate: false });
    expect(r.items).toHaveLength(1);
    expect(await qa(outsider, lessonPaid)).toBeNull();
    expect(await qa(ownerB, lessonPaid)).toBeNull();
  });
  it("teachers answer, and the answer is marked as a teacher's", async () => {
    const qid = (await qa(student, lessonPaid)).items[0].id;
    await q(teacherA, `select post_answer($1,'Use the past form.')`, [qid]);
    await q(other, `select post_answer($1,'I think so too.')`, [qid]);
    const answers = (await qa(student, lessonPaid)).items[0].answers;
    expect(answers.map((a: any) => [a.teacher, a.body])).toEqual([[true, "Use the past form."], [false, "I think so too."]]);
  });
  it("validates length and rejects outsiders answering", async () => {
    const qid = (await qa(student, lessonPaid)).items[0].id;
    expect(await failure(student, `select ask_question($1,'hi')`, [lessonPaid])).toMatch(/at least 3/);
    expect(await failure(student, `select ask_question($1,$2)`, [lessonPaid, "x".repeat(1001)])).toMatch(/under 1000/);
    expect(await failure(student, `select post_answer($1,' ')`, [qid])).toMatch(/Write your answer/);
    expect(await failure(outsider, `select post_answer($1,'Let me in')`, [qid])).toMatch(/Enroll/);
  });
  it("limits questions to 10 a day", async () => {
    await db.query(`insert into lesson_questions (lesson_id,course_id,user_id,author_name,body) select $1,$2,$3,'Other','filler question' from generate_series(1,10)`, [lessonPaid, course, other]);
    expect(await failure(other, `select ask_question($1,'One too many')`, [lessonPaid])).toMatch(/Try again tomorrow/);
  });
});

describe("moderation and privacy", () => {
  it("learners cannot write or read the tables directly", async () => {
    expect(await failure(student, `insert into lesson_questions (lesson_id,course_id,user_id,author_name,body) values ('${lessonPaid}','${course}','${student}','x','hello there')`)).toMatch(/permission denied/);
    expect(await q(student, `select 1 from lesson_questions`)).toHaveLength(0);
    expect(await q(outsider, `select 1 from lesson_answers`)).toHaveLength(0);
    expect((await q(teacherA, `select 1 from lesson_questions`)).length).toBeGreaterThan(0);
    expect(await q(ownerB, `select 1 from lesson_questions`)).toHaveLength(0);
  });
  it("only the academy's teachers hide posts; hidden posts vanish for learners but not for teachers; audited", async () => {
    const qid = (await qa(student, lessonPaid)).items.find((i: any) => i.body.startsWith("How do I"))!.id;
    expect(await failure(student, `select set_qa_hidden('question',$1,true)`, [qid])).toMatch(/Not found/);
    expect(await failure(ownerB, `select set_qa_hidden('question',$1,true)`, [qid])).toMatch(/Not found/);
    await q(teacherA, `select set_qa_hidden('question',$1,true)`, [qid]);
    expect((await qa(student, lessonPaid)).items.some((i: any) => i.id === qid)).toBe(false);
    const seen = (await qa(teacherA, lessonPaid)).items.find((i: any) => i.id === qid);
    expect(seen).toMatchObject({ hidden: true });
    expect(await failure(other, `select post_answer($1,'Replying to hidden')`, [qid])).toMatch(/Question not found/);
    await q(teacherA, `select set_qa_hidden('question',$1,false)`, [qid]);
    expect((await qa(student, lessonPaid)).items.some((i: any) => i.id === qid)).toBe(true);
    const audit = await db.query(`select action from audit_logs where action in ('qa.hidden','qa.unhidden') order by created_at`);
    expect((audit.rows as any[]).map((r) => r.action)).toEqual(["qa.hidden", "qa.unhidden"]);
  });
  it("hides a single answer", async () => {
    const item = (await qa(student, lessonPaid)).items.find((i: any) => i.answers.length > 0);
    const aid = item.answers[1].id;
    await q(teacherA, `select set_qa_hidden('answer',$1,true)`, [aid]);
    expect((await qa(student, lessonPaid)).items.find((i: any) => i.id === item.id).answers).toHaveLength(1);
    expect((await qa(teacherA, lessonPaid)).items.find((i: any) => i.id === item.id).answers).toHaveLength(2);
  });
});
