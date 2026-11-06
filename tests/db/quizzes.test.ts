import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let ownerA: string, teacherA: string, ownerB: string, student: string, outsider: string;
let course: string, mod: string, lesson: string, lessonNoQuiz: string, quiz: string;
let q1: string, q2: string, q1ok: string, q1bad: string, q2ok: string, q2bad: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) => as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};
const answers = (a: string, b: string) => JSON.stringify({ [q1]: a, [q2]: b });

beforeAll(async () => {
  db = await createDb();
  [ownerA, teacherA, ownerB, student, outsider] = await Promise.all(["ownerA", "teacherA", "ownerB", "student", "outsider"].map((n) => newUser(db, n)));
  const academyA = (await q(ownerA, `select register_academy('Academy A','academy-a') r`))[0].r;
  await q(ownerB, `select register_academy('Academy B','academy-b') r`);
  await db.exec(`update academies set status='active'`);
  await db.query(`insert into memberships (academy_id,user_id,role) values ($1,$2,'instructor')`, [academyA, teacherA]);

  course = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'sarf','Sarf',$2) returning id`, [academyA, ownerA]))[0].id;
  mod = (await q(ownerA, `insert into course_modules (course_id,title) values ($1,'Unit') returning id`, [course]))[0].id;
  lesson = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'Lesson one',1) returning id`, [course, mod]))[0].id;
  lessonNoQuiz = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'Lesson two',2) returning id`, [course, mod]))[0].id;
  await db.exec(`update courses set status='published' where id='${course}'`);

  quiz = (await q(teacherA, `insert into quizzes (lesson_id,title,pass_percent) values ($1,'Check',50) returning id`, [lesson]))[0].id;
  q1 = (await q(teacherA, `insert into quiz_questions (quiz_id,prompt,explanation,position) values ($1,'Q one?','Because.',1) returning id`, [quiz]))[0].id;
  q2 = (await q(teacherA, `insert into quiz_questions (quiz_id,prompt,position) values ($1,'Q two?',2) returning id`, [quiz]))[0].id;
  q1ok = (await q(teacherA, `insert into quiz_options (question_id,label,is_correct,position) values ($1,'Right',true,1) returning id`, [q1]))[0].id;
  q1bad = (await q(teacherA, `insert into quiz_options (question_id,label,position) values ($1,'Wrong',2) returning id`, [q1]))[0].id;
  q2ok = (await q(teacherA, `insert into quiz_options (question_id,label,is_correct,position) values ($1,'Right',true,1) returning id`, [q2]))[0].id;
  q2bad = (await q(teacherA, `insert into quiz_options (question_id,label,position) values ($1,'Wrong',2) returning id`, [q2]))[0].id;
  await q(student, `select enroll_in_course($1)`, [course]);
});

describe("quiz authoring", () => {
  it("another academy's owner and learners cannot create or read quiz tables", async () => {
    expect(await failure(ownerB, `insert into quizzes (lesson_id,title) values ('${lessonNoQuiz}','Hijack')`)).toMatch(/row-level security/);
    expect(await q(ownerB, `select id from quizzes`)).toHaveLength(0);
    expect(await q(student, `select id from quizzes`)).toHaveLength(0);
    expect(await q(student, `select id from quiz_options`)).toHaveLength(0);
  });
  it("allows one correct option per question and one quiz per lesson", async () => {
    expect(await failure(teacherA, `insert into quiz_options (question_id,label,is_correct) values ('${q1}','Also right',true)`)).toMatch(/duplicate key|unique/);
    expect(await failure(teacherA, `insert into quizzes (lesson_id,title) values ('${lesson}','Second')`)).toMatch(/duplicate key|unique/);
  });
  it("caps options per question", async () => {
    const extra = (await q(teacherA, `insert into quiz_questions (quiz_id,prompt,position) values ($1,'Cap?',9) returning id`, [quiz]))[0].id;
    for (let i = 0; i < 6; i++) await q(teacherA, `insert into quiz_options (question_id,label) values ($1,$2)`, [extra, `o${i}`]);
    expect(await failure(teacherA, `insert into quiz_options (question_id,label) values ($1,'seventh')`, [extra])).toMatch(/at most 6/);
    await q(teacherA, `delete from quiz_questions where id=$1`, [extra]);
  });
});

describe("taking a quiz", () => {
  it("get_quiz never exposes the answer key", async () => {
    const [{ r }] = await q(student, `select get_quiz($1) r`, [lesson]);
    expect(r.questions).toHaveLength(2);
    expect(JSON.stringify(r)).not.toMatch(/correct/);
    expect(r.questions[0].options).toHaveLength(2);
  });
  it("is hidden from guests and from people who cannot open the lesson", async () => {
    expect(await failure(null, `select get_quiz('${lesson}')`)).toMatch(/permission denied/);
    expect((await q(outsider, `select get_quiz($1) r`, [lesson]))[0].r).toBeNull();
    expect((await q(student, `select get_quiz($1) r`, [lessonNoQuiz]))[0].r).toBeNull();
  });
  it("scores on the server, stores the attempt and reveals answers only afterwards", async () => {
    const [{ r }] = await q(student, `select submit_quiz_attempt($1,$2::jsonb) r`, [quiz, answers(q1ok, q2bad)]);
    expect(r).toMatchObject({ score: 1, total: 2, percent: 50, passed: true });
    expect(r.review.find((x: any) => x.question_id === q2)).toMatchObject({ correct: q2ok, is_correct: false });
    expect(r.review.find((x: any) => x.question_id === q1).explanation).toBe("Because.");
    expect(await q(student, `select score, passed from quiz_attempts`)).toEqual([{ score: 1, passed: true }]);
  });
  it("fails below the pass mark", async () => {
    const [{ r }] = await q(student, `select submit_quiz_attempt($1,$2::jsonb) r`, [quiz, answers(q1bad, q2bad)]);
    expect(r).toMatchObject({ score: 0, percent: 0, passed: false });
  });
  it("rejects missing, foreign or malformed answers", async () => {
    expect(await failure(student, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, JSON.stringify({ [q1]: q1ok })])).toMatch(/Answer every question/);
    expect(await failure(student, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, answers(q2ok, q2ok)])).toMatch(/Answer every question/);
    expect(await failure(student, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, answers("nope", q2ok)])).toMatch(/Answer every question/);
    expect(await failure(student, `select submit_quiz_attempt($1,'[]'::jsonb)`, [quiz])).toMatch(/Answer every question/);
  });
  it("keeps attempts private to the learner, visible to the academy's teachers, and unwritable by clients", async () => {
    expect(await failure(outsider, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, answers(q1ok, q2ok)])).toMatch(/Quiz not found/);
    expect(await q(outsider, `select 1 from quiz_attempts`)).toHaveLength(0);
    expect((await q(teacherA, `select 1 from quiz_attempts`)).length).toBeGreaterThan(0);
    expect(await q(ownerB, `select 1 from quiz_attempts`)).toHaveLength(0);
    expect(await failure(student, `insert into quiz_attempts (quiz_id,user_id,course_id,score,total,percent,passed,answers) values ('${quiz}','${student}','${course}',2,2,100,true,'{}')`)).toMatch(/permission denied/);
  });
  it("refuses a quiz whose question has no correct option", async () => {
    const l = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'Three',3) returning id`, [course, mod]))[0].id;
    const qz = (await q(teacherA, `insert into quizzes (lesson_id,title) values ($1,'Broken') returning id`, [l]))[0].id;
    const qq = (await q(teacherA, `insert into quiz_questions (quiz_id,prompt) values ($1,'No key?') returning id`, [qz]))[0].id;
    const o = (await q(teacherA, `insert into quiz_options (question_id,label) values ($1,'a') returning id`, [qq]))[0].id;
    expect(await failure(student, `select submit_quiz_attempt($1,$2::jsonb)`, [qz, JSON.stringify({ [qq]: o })])).toMatch(/not ready/);
  });
  it("limits attempts to 30 a day", async () => {
    await db.query(`insert into quiz_attempts (quiz_id,user_id,course_id,score,total,percent,passed,answers)
      select $1,$2,$3,0,2,0,false,'{}' from generate_series(1,30)`, [quiz, student, course]);
    expect(await failure(student, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, answers(q1ok, q2ok)])).toMatch(/Too many attempts/);
  });
});

describe("quiz gate on completing a lesson", () => {
  it("blocks Mark complete until the quiz is passed, never blocks lessons without a quiz", async () => {
    const fresh = await newUser(db, "fresh");
    await q(fresh, `select enroll_in_course($1)`, [course]);
    expect(await failure(fresh, `select complete_lesson($1)`, [lesson])).toMatch(/Pass the lesson quiz/);
    expect(await failure(fresh, `select complete_lesson($1)`, [lessonNoQuiz])).toBeNull();
    await q(fresh, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, answers(q1bad, q2bad)]);
    expect(await failure(fresh, `select complete_lesson($1)`, [lesson])).toMatch(/Pass the lesson quiz/);
    await q(fresh, `select submit_quiz_attempt($1,$2::jsonb)`, [quiz, answers(q1ok, q2ok)]);
    expect(await failure(fresh, `select complete_lesson($1)`, [lesson])).toBeNull();
    expect(await failure(fresh, `select complete_lesson($1)`, [lesson])).toBeNull(); // still idempotent
  });
});
