import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let ownerA: string, adminA: string, teacherA: string, ownerB: string, teacherB: string, student: string, learner: string, stranger: string, hopeful: string;
let academyA: string, academyB: string;
let course: string, mod1: string, mod2: string, l1: string, l2: string, l3: string, courseB: string, modB: string, lB: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) =>
  as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};

beforeAll(async () => {
  db = await createDb();
  [ownerA, adminA, teacherA, ownerB, teacherB, student, learner, stranger, hopeful] =
    await Promise.all(["ownerA", "adminA", "teacherA", "ownerB", "teacherB", "student", "learner", "stranger", "hopeful"].map((n) => newUser(db, n)));
  academyA = (await q(ownerA, `select register_academy('Academy A','academy-a') r`))[0].r;
  academyB = (await q(ownerB, `select register_academy('Academy B','academy-b') r`))[0].r;
  await db.exec(`update academies set status='active'`);
  await db.query(`insert into memberships (academy_id,user_id,role) values ($1,$2,'academy_admin'),($1,$3,'instructor'),($4,$5,'instructor')`, [academyA, adminA, teacherA, academyB, teacherB]);

  course = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'sarf','Sarf Basics',$2) returning id`, [academyA, ownerA]))[0].id;
  mod1 = (await q(ownerA, `insert into course_modules (course_id,title,position) values ($1,'Unit 1',1) returning id`, [course]))[0].id;
  mod2 = (await q(ownerA, `insert into course_modules (course_id,title,position) values ($1,'Unit 2',2) returning id`, [course]))[0].id;
  l1 = (await q(ownerA, `insert into lessons (course_id,module_id,title,is_preview,position) values ($1,$2,'One',true,1) returning id`, [course, mod1]))[0].id;
  l2 = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'Two',2) returning id`, [course, mod1]))[0].id;
  l3 = (await q(ownerA, `insert into lessons (course_id,module_id,title,position) values ($1,$2,'Three',1) returning id`, [course, mod2]))[0].id;
  await db.exec(`update courses set status='published' where id='${course}'`);

  courseB = (await q(ownerB, `insert into courses (academy_id,slug,title,created_by) values ($1,'other','Other Course',$2) returning id`, [academyB, ownerB]))[0].id;
  modB = (await q(ownerB, `insert into course_modules (course_id,title) values ($1,'B1') returning id`, [courseB]))[0].id;
  lB = (await q(ownerB, `insert into lessons (course_id,module_id,title) values ($1,$2,'B lesson') returning id`, [courseB, modB]))[0].id;
});

describe("teachers", () => {
  it("can add and edit modules and lessons in their own academy's courses", async () => {
    const m = (await q(teacherA, `insert into course_modules (course_id,title,position) values ($1,'Teacher unit',3) returning id`, [course]))[0].id;
    await q(teacherA, `insert into lessons (course_id,module_id,title,body) values ($1,$2,'Teacher lesson','text')`, [course, m]);
    expect(await q(teacherA, `update lessons set title='Renamed One' where id=$1 returning id`, [l1])).toHaveLength(1);
    expect(await q(teacherA, `delete from lessons where title='Teacher lesson' returning id`)).toHaveLength(1);
  });

  it("can see their academy's draft courses and roster, but not change the course or publish it", async () => {
    const draft = (await q(ownerA, `insert into courses (academy_id,slug,title,created_by) values ($1,'draft-one','Draft One',$2) returning id`, [academyA, ownerA]))[0].id;
    expect(await q(teacherA, `select id from courses where id=$1`, [draft])).toHaveLength(1);
    expect(await q(teacherA, `update courses set title='Mine now' where id=$1 returning id`, [draft])).toHaveLength(0);
    expect(await q(teacherA, `update courses set status='archived' where id=$1 returning id`, [course])).toHaveLength(0);
    expect(await failure(teacherA, `insert into courses (academy_id,slug,title,created_by) values ('${academyA}','t-course','T Course','${teacherA}')`)).toMatch(/row-level security/);
    await q(learner, `select enroll_in_course($1)`, [course]);
    expect(await q(teacherA, `select 1 from enrollments where course_id=$1`, [course])).toHaveLength(1);
  });

  it("cannot touch another academy's courses, and another academy's teacher cannot touch theirs", async () => {
    expect(await failure(teacherA, `insert into lessons (course_id,module_id,title) values ('${courseB}','${modB}','Injected')`)).toMatch(/row-level security/);
    expect(await q(teacherA, `update lessons set title='x' where id=$1 returning id`, [lB])).toHaveLength(0);
    expect(await q(teacherA, `select id from courses where id=$1`, [courseB])).toHaveLength(0);
    expect(await failure(teacherB, `insert into lessons (course_id,module_id,title) values ('${course}','${mod1}','Injected')`)).toMatch(/row-level security/);
    expect(await q(teacherB, `select 1 from enrollments where course_id=$1`, [course])).toHaveLength(0);
    expect(await q(teacherB, `delete from lessons where id=$1 returning id`, [l2])).toHaveLength(0);
  });

  it("a plain student or stranger cannot author", async () => {
    expect(await failure(student, `insert into course_modules (course_id,title) values ('${course}','No')`)).toMatch(/row-level security/);
    expect(await failure(stranger, `insert into lessons (course_id,module_id,title) values ('${course}','${mod1}','No')`)).toMatch(/row-level security/);
  });

  it("a teacher cannot grant themselves more: no membership writes, no academy edits", async () => {
    expect(await failure(teacherA, `insert into memberships (academy_id,user_id,role) values ('${academyA}','${teacherA}','academy_admin')`)).toMatch(/row-level security/);
    expect(await q(teacherA, `update academies set name='Taken' where id=$1 returning id`, [academyA])).toHaveLength(0);
  });
});

describe("invitations", () => {
  it("the owner and admins can invite a teacher; only the owner can invite an admin", async () => {
    expect(typeof (await q(ownerA, `select invite_to_academy($1,'t1@example.com','instructor') t`, [academyA]))[0].t).toBe("string");
    expect(await failure(adminA, `select invite_to_academy($1,'t2@example.com','instructor')`, [academyA])).toBeNull();
    expect(await failure(adminA, `select invite_to_academy($1,'a1@example.com','academy_admin')`, [academyA])).toMatch(/Not allowed/);
    expect(await failure(ownerA, `select invite_to_academy($1,'a1@example.com','academy_admin')`, [academyA])).toBeNull();
  });

  it("teachers, students, strangers and other academies cannot invite", async () => {
    for (const u of [teacherA, student, stranger, ownerB]) {
      expect(await failure(u, `select invite_to_academy($1,'x@example.com','instructor')`, [academyA]), u).toMatch(/Not allowed/);
    }
    expect(await failure(null, `select invite_to_academy($1,'x@example.com','instructor')`, [academyA])).toMatch(/permission denied/);
  });

  it("cannot invite as owner or student, or with a bad address", async () => {
    expect(await failure(ownerA, `select invite_to_academy($1,'x@example.com','academy_owner')`, [academyA])).toMatch(/teacher or an admin/);
    expect(await failure(ownerA, `select invite_to_academy($1,'not-an-email','instructor')`, [academyA])).toMatch(/valid email/);
  });

  it("the link joins as the invited role once, and stores only a hash", async () => {
    const token = (await q(ownerA, `select invite_to_academy($1,'hope@example.com','instructor') t`, [academyA]))[0].t as string;
    const stored = await db.query<{ token_hash: string }>(`select token_hash from academy_invites where email='hope@example.com'`);
    expect(stored.rows[0].token_hash).not.toContain(token);
    expect(await failure(null, `select accept_invite($1)`, [token])).toMatch(/permission denied/);
    expect(await failure(hopeful, `select accept_invite('wrong')`)).toMatch(/not valid/);
    expect((await q(hopeful, `select accept_invite($1) a`, [token]))[0].a).toBe(academyA);
    const m = await db.query<any>(`select role,status from memberships where user_id=$1 and academy_id=$2`, [hopeful, academyA]);
    expect(m.rows).toEqual([{ role: "instructor", status: "active" }]);
    expect(await failure(stranger, `select accept_invite($1)`, [token])).toMatch(/not valid/); // single use
    // and the new teacher can author straight away
    expect(await failure(hopeful, `insert into course_modules (course_id,title) values ('${course}','By invitee')`)).toBeNull();
  });

  it("a replaced, revoked or expired link no longer works", async () => {
    const first = (await q(ownerA, `select invite_to_academy($1,'dup@example.com','instructor') t`, [academyA]))[0].t as string;
    const second = (await q(ownerA, `select invite_to_academy($1,'dup@example.com','instructor') t`, [academyA]))[0].t as string;
    expect(await failure(stranger, `select accept_invite($1)`, [first])).toMatch(/not valid/);
    const id = (await db.query<{ id: string }>(`select id from academy_invites where status='pending' and email='dup@example.com'`)).rows[0].id;
    await q(ownerA, `select revoke_invite($1)`, [id]);
    expect(await failure(stranger, `select accept_invite($1)`, [second])).toMatch(/not valid/);
    const third = (await q(ownerA, `select invite_to_academy($1,'late@example.com','instructor') t`, [academyA]))[0].t as string;
    await db.exec(`update academy_invites set expires_at = now() - interval '1 minute' where email='late@example.com'`);
    expect(await failure(stranger, `select accept_invite($1)`, [third])).toMatch(/not valid/);
  });

  it("only that academy's staff can list or revoke its invitations", async () => {
    expect((await q(ownerA, `select id from academy_invites`)).length).toBeGreaterThan(0);
    for (const u of [teacherA, student, ownerB, null]) expect(await q(u, `select id from academy_invites`).catch(() => [])).toHaveLength(0);
    const id = (await db.query<{ id: string }>(`select id from academy_invites where status='pending' limit 1`)).rows[0].id;
    expect(await failure(ownerB, `select revoke_invite($1)`, [id])).toMatch(/not found/);
  });

  it("an invite cannot be accepted while the academy is not approved", async () => {
    const token = (await q(ownerA, `select invite_to_academy($1,'wait@example.com','instructor') t`, [academyA]))[0].t as string;
    await db.exec(`update academies set status='suspended' where id='${academyA}'`);
    expect(await failure(stranger, `select accept_invite($1)`, [token])).toMatch(/not open/);
    await db.exec(`update academies set status='active' where id='${academyA}'`);
  });
});

describe("lesson progress", () => {
  it("only people who can open a lesson record progress on it", async () => {
    expect(await failure(stranger, `select complete_lesson($1)`, [l2])).toMatch(/not found/); // not enrolled, not a preview
    expect(await failure(null, `select complete_lesson($1)`, [l1])).toMatch(/permission denied/);
    expect(await failure(stranger, `select record_lesson_position($1,10)`, [l2])).toMatch(/not found/);
    expect(await failure(stranger, `select complete_lesson($1)`, [l1])).toBeNull(); // preview lessons are open to signed-in users
  });

  it("clients cannot write progress directly, nor read anyone else's", async () => {
    expect(await failure(learner, `insert into lesson_progress (user_id,lesson_id,course_id,completed_at) values ('${learner}','${l2}','${course}',now())`)).toMatch(/permission denied/);
    expect(await failure(learner, `update lesson_progress set completed_at=now()`)).toMatch(/permission denied/);
    await q(learner, `select complete_lesson($1)`, [l1]);
    expect(await q(learner, `select 1 from lesson_progress`)).toHaveLength(1);
    expect(await q(student, `select 1 from lesson_progress`)).toHaveLength(0);
    expect(await q(ownerB, `select 1 from lesson_progress`)).toHaveLength(0);
    expect(await q(teacherA, `select 1 from lesson_progress where user_id=$1`, [learner])).toHaveLength(1);
    expect(await q(teacherB, `select 1 from lesson_progress where user_id=$1`, [learner])).toHaveLength(0);
  });

  it("remembers the video position and keeps the first completion time", async () => {
    await q(learner, `select record_lesson_position($1,95)`, [l2]);
    expect((await q(learner, `select last_position_seconds s, completed_at from lesson_progress where lesson_id=$1`, [l2]))[0]).toMatchObject({ s: 95, completed_at: null });
    await q(learner, `select complete_lesson($1)`, [l2]);
    const first = (await q(learner, `select completed_at from lesson_progress where lesson_id=$1`, [l2]))[0].completed_at as Date;
    await q(learner, `select complete_lesson($1)`, [l2]);
    expect((await q(learner, `select completed_at from lesson_progress where lesson_id=$1`, [l2]))[0].completed_at.getTime()).toBe(first.getTime());
    await q(learner, `select record_lesson_position($1,12)`, [l2]); // moving the playhead never un-completes a lesson
    expect((await q(learner, `select completed_at from lesson_progress where lesson_id=$1`, [l2]))[0].completed_at).not.toBeNull();
    expect(await failure(learner, `select record_lesson_position($1,999999)`, [l2])).toBeNull(); // clamped, not an error
    expect((await q(learner, `select last_position_seconds s from lesson_progress where lesson_id=$1`, [l2]))[0].s).toBe(86400);
  });

  it("'complete and next' returns the next lesson across modules, and null at the end", async () => {
    expect((await q(learner, `select complete_lesson($1) n`, [l1]))[0].n).toBe(l2);
    expect((await q(learner, `select complete_lesson($1) n`, [l2]))[0].n).toBe(l3);
    expect((await q(learner, `select complete_lesson($1) n`, [l3]))[0].n).toBeNull();
  });

  it("course percent counts completed lessons out of all lessons", async () => {
    await q(student, `select enroll_in_course($1)`, [course]);
    const total = (await q(student, `select * from course_progress($1)`, [course]))[0];
    expect(total).toMatchObject({ completed_lessons: 0, percent: 0 });
    await q(student, `select complete_lesson($1)`, [l1]);
    const p = (await q(student, `select * from course_progress($1)`, [course]))[0];
    expect(p.completed_lessons).toBe(1);
    expect(p.percent).toBe(Math.floor((100 * 1) / p.total_lessons));
    const full = (await q(learner, `select * from course_progress($1)`, [course]))[0];
    expect(full.percent).toBe(Math.floor((100 * full.completed_lessons) / full.total_lessons));
    expect(await failure(null, `select * from course_progress($1)`, [course])).toMatch(/permission denied/);
  });

  it("a learner who leaves loses access to record more, but keeps what they finished", async () => {
    await q(student, `select leave_course($1)`, [course]);
    expect(await failure(student, `select complete_lesson($1)`, [l2])).toMatch(/not found/);
    expect(await q(student, `select 1 from lesson_progress where completed_at is not null`)).toHaveLength(1);
  });
});
