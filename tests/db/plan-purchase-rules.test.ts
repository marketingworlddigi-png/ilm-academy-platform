import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let admin: string;
let monthly: string, yearly: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) =>
  as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};
const create = async (user: string, plan: string) => (await q(user, `select create_payment($1,'jazzcash') id`, [plan]))[0].id as string;
const preview = async (user: string, plan: string, as_?: string, months?: number) =>
  (await q(as_ ?? user, `select * from plan_purchase_preview($1,$2,$3)`, [user, plan, months ?? null]))[0];

async function submit(user: string, id: string, ref: string) {
  const path = `${user}/${id}/proof.png`;
  await q(user, `insert into storage.objects (bucket_id,name) values ('payment-proofs',$1)`, [path]);
  await q(user, `select submit_payment($1,$2,$3)`, [id, ref, path]);
}
let n = 0;
/** A fresh user who has bought and been approved for `plan`; returns the user and that payment. */
async function subscriber(plan: string) {
  const user = await newUser(db, `sub-${++n}`);
  const pay = await create(user, plan);
  await submit(user, pay, `RULES-REF-${String(n).padStart(4, "0")}`);
  await q(admin, `select approve_payment($1)`, [pay]);
  return { user, pay };
}
const ent = async (payment: string) => (await db.query<any>(`select starts_at, expires_at from entitlements where payment_id=$1`, [payment])).rows[0];
const endIn = (payment: string, interval: string) => db.query(`update entitlements set expires_at = now() + interval '${interval}' where payment_id=$1`, [payment]);

beforeAll(async () => {
  db = await createDb();
  admin = await newUser(db, "admin");
  await db.query(`insert into platform_admins (user_id) values ($1)`, [admin]);
  await q(admin, `update payment_methods set is_active=true where code='jazzcash'`);
  await q(admin, `update plans set is_active=true`);
  monthly = (await db.query<{ id: string }>(`select id from plans where code='premium-monthly'`)).rows[0].id;
  yearly = (await db.query<{ id: string }>(`select id from plans where code='premium-yearly'`)).rows[0].id;
});

describe("rule 1: the same plan cannot be bought again until the last 7 days", () => {
  it("is blocked with the plan, end date and renewal date in the message", async () => {
    const { user, pay } = await subscriber(monthly);
    await endIn(pay, "20 days");
    const msg = await failure(user, `select create_payment($1,'jazzcash')`, [monthly]);
    expect(msg).toMatch(/^You already have Premium monthly until \d{1,2} [A-Z][a-z]+ \d{4}\. You can renew it from \d{1,2} [A-Z][a-z]+ \d{4}\.$/);
    const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(d);
    const end = (await ent(pay)).expires_at as Date;
    expect(msg).toContain(`until ${day(end)}.`);
    expect(msg).toContain(`renew it from ${day(new Date(end.getTime() - 7 * 86400_000))}.`);
  });

  it("applies to the yearly plan too", async () => {
    const { user } = await subscriber(yearly);
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [yearly])).toMatch(/You already have Premium yearly until/);
  });

  it("is allowed inside the 7-day renewal window, and just outside it is not", async () => {
    const { user, pay } = await subscriber(monthly);
    await endIn(pay, "8 days");
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [monthly])).toMatch(/You can renew it from/);
    await endIn(pay, "6 days 23 hours");
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [monthly])).toBeNull();
  });

  it("is allowed again once the plan has run out", async () => {
    const { user, pay } = await subscriber(monthly);
    await db.query(`update entitlements set starts_at=now() - interval '40 days', expires_at=now() - interval '1 day' where payment_id=$1`, [pay]);
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [monthly])).toBeNull();
  });

  it("does not stop someone who never bought it", async () => {
    const user = await newUser(db, "newcomer");
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [monthly])).toBeNull();
  });
});

describe("rule 2: a different plan can be bought at any time and is stacked", () => {
  it("monthly to yearly: allowed now, starts when the monthly period ends", async () => {
    const { user, pay: monthlyPay } = await subscriber(monthly);
    const yearlyPay = await create(user, yearly);
    await submit(user, yearlyPay, "SWITCH-TO-YEARLY");
    await q(admin, `select approve_payment($1)`, [yearlyPay]);
    const a = await ent(monthlyPay), b = await ent(yearlyPay);
    expect(b.starts_at.getTime()).toBe(a.expires_at.getTime());
    expect(Math.round((b.expires_at.getTime() - b.starts_at.getTime()) / 86400_000)).toBeGreaterThanOrEqual(365);
  });

  it("yearly to monthly: allowed now, starts when the yearly period ends", async () => {
    const { user, pay: yearlyPay } = await subscriber(yearly);
    const monthlyPay = await create(user, monthly);
    await submit(user, monthlyPay, "SWITCH-TO-MONTHLY");
    await q(admin, `select approve_payment($1)`, [monthlyPay]);
    expect((await ent(monthlyPay)).starts_at.getTime()).toBe((await ent(yearlyPay)).expires_at.getTime());
  });

  it("the stacked plan then follows the same rule: its own plan is blocked, the first plan only inside its last 7 days", async () => {
    const { user, pay: monthlyPay } = await subscriber(monthly);
    const yearlyPay = await create(user, yearly);
    await submit(user, yearlyPay, "STACK-YEARLY-01");
    await q(admin, `select approve_payment($1)`, [yearlyPay]);
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [yearly])).toMatch(/You already have Premium yearly/);
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [monthly])).toMatch(/You already have Premium monthly/);
    await endIn(monthlyPay, "3 days");
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [monthly])).toBeNull();
  });
});

describe("rule 3: a payment being reviewed blocks new ones", () => {
  it("submitted blocks, with the code in the message", async () => {
    const user = await newUser(db, "waiting");
    const pay = await create(user, monthly);
    await submit(user, pay, "WAITING-REF-001");
    const code = (await q(user, `select code from payments where id=$1`, [pay]))[0].code;
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [yearly])).toBe(`You have a payment being reviewed (code ${code}). Please wait for it to be checked.`);
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [monthly])).toMatch(/payment being reviewed/);
  });

  it("under review blocks too, and rejection frees the user again", async () => {
    const user = await newUser(db, "waiting2");
    const pay = await create(user, monthly);
    await submit(user, pay, "WAITING-REF-002");
    await q(admin, `select claim_payment_review($1)`, [pay]);
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [yearly])).toMatch(/payment being reviewed/);
    await q(admin, `select reject_payment($1,'unreadable')`, [pay]);
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [yearly])).toBeNull();
  });

  it("someone else's pending payment does not block you", async () => {
    const a = await newUser(db, "a"), b = await newUser(db, "b");
    await submit(a, await create(a, monthly), "NOT-YOUR-BLOCK-1");
    expect(await failure(b, `select create_payment($1,'jazzcash')`, [monthly])).toBeNull();
  });

  it("an unpaid payment for the same plan is reused, even with another method", async () => {
    await q(admin, `update payment_methods set is_active=true where code='easypaisa'`);
    const user = await newUser(db, "reuser");
    const a = await create(user, monthly);
    const b = (await q(user, `select create_payment($1,'easypaisa') id`, [monthly]))[0].id;
    expect(b).toBe(a);
    expect((await q(user, `select method_code from payments where id=$1`, [a]))[0].method_code).toBe("easypaisa");
  });

  it("an unpaid payment for another plan is cancelled and replaced, and audited", async () => {
    const user = await newUser(db, "switcher");
    const a = await create(user, monthly);
    const b = await create(user, yearly);
    expect(b).not.toBe(a);
    expect((await q(user, `select status from payments where id=$1`, [a]))[0].status).toBe("cancelled");
    expect((await q(user, `select status from payments where id=$1`, [b]))[0].status).toBe("pending");
    const log = await db.query(`select 1 from audit_logs where action='payment.cancelled' and entity_id=$1`, [a]);
    expect(log.rows).toHaveLength(1);
  });

  it("a blocked same-plan purchase does not cancel the user's unpaid payment", async () => {
    const { user, pay } = await subscriber(monthly);
    const open = await create(user, yearly);
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [monthly])).toMatch(/You already have/);
    expect((await q(user, `select status from payments where id=$1`, [open]))[0].status).toBe("pending");
    expect(pay).toBeTruthy();
  });
});

describe("rule 4: the plan behind the current Premium is known", () => {
  it("the preview names the current plan and the end of that plan", async () => {
    const { user, pay } = await subscriber(yearly);
    const p = await preview(user, monthly);
    expect(p).toMatchObject({ current_plan_id: yearly, current_plan_name: "Premium yearly", blocked: false });
    expect(p.current_ends_at.getTime()).toBe((await ent(pay)).expires_at.getTime());
  });

  it("a user without Premium has no current plan", async () => {
    const user = await newUser(db, "free");
    expect(await preview(user, monthly)).toMatchObject({ current_plan_id: null, current_plan_name: null, current_ends_at: null, blocked: false });
  });

  it("an open-ended grant (no payment) does not break the preview or block anything", async () => {
    const user = await newUser(db, "granted");
    await db.query(`insert into entitlements (user_id,scope,source,granted_by) values ($1,'platform','manual_grant',$2)`, [user, admin]);
    expect(await preview(user, monthly)).toMatchObject({ current_plan_id: null, blocked: false });
    expect(await failure(user, `select create_payment($1,'jazzcash')`, [monthly])).toBeNull();
  });
});

describe("rules 6 and 7: the dates shown are the dates approval grants", () => {
  it("stacked period: preview start/end equal the granted entitlement exactly", async () => {
    const { user } = await subscriber(monthly);
    const pay = await create(user, yearly);
    const p = await preview(user, yearly);
    await submit(user, pay, "PREVIEW-MATCH-01");
    await q(admin, `select approve_payment($1)`, [pay]);
    const e = await ent(pay);
    expect(p.period_starts_at.getTime()).toBe(e.starts_at.getTime());
    expect(p.period_ends_at.getTime()).toBe(e.expires_at.getTime());
  });

  it("first purchase: starts now (to the second) and runs for the plan length", async () => {
    const user = await newUser(db, "first");
    const pay = await create(user, monthly);
    const p = await preview(user, monthly);
    await submit(user, pay, "PREVIEW-MATCH-02");
    await q(admin, `select approve_payment($1)`, [pay]);
    const e = await ent(pay);
    expect(Math.abs(e.starts_at.getTime() - p.period_starts_at.getTime())).toBeLessThan(10_000);
    const months = (await db.query<any>(`select (expires_at = starts_at + interval '1 month') ok from entitlements where payment_id=$1`, [pay])).rows[0];
    expect(months.ok).toBe(true);
  });

  it("the admin preview uses the payment's own length, even if the plan changed afterwards", async () => {
    const { user } = await subscriber(yearly);
    const pay = await create(user, monthly);
    await submit(user, pay, "PREVIEW-MATCH-03");
    await db.query(`update plans set duration_months=3 where id=$1`, [monthly]);
    const p = await preview(user, monthly, admin, 1);
    await q(admin, `select approve_payment($1)`, [pay]);
    await db.query(`update plans set duration_months=1 where id=$1`, [monthly]);
    const e = await ent(pay);
    expect(p.period_starts_at.getTime()).toBe(e.starts_at.getTime());
    expect(p.period_ends_at.getTime()).toBe(e.expires_at.getTime());
  });
});

describe("who may ask for a preview", () => {
  it("only the user themselves or a super admin", async () => {
    const { user } = await subscriber(monthly);
    const stranger = await newUser(db, "stranger");
    expect(await failure(stranger, `select * from plan_purchase_preview($1,$2,null)`, [user, monthly])).toMatch(/Not allowed/);
    expect(await failure(null, `select * from plan_purchase_preview($1,$2,null)`, [user, monthly])).toMatch(/permission denied/);
    expect(await failure(admin, `select * from plan_purchase_preview($1,$2,null)`, [user, monthly])).toBeNull();
  });
  it("platform_period_start is not callable from the browser", async () => {
    const user = await newUser(db, "peek");
    expect(await failure(user, `select platform_period_start($1)`, [user])).toMatch(/permission denied/);
  });
});
