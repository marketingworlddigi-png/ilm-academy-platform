import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let admin: string, student: string, other: string;
let planMonthly: string, planYearly: string, res: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) =>
  as(db, user, async () => (await db.query(sql, params)).rows as any[]);
/** The error message a statement fails with, or null if it succeeded. */
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};
const canView = async (user: string) => (await q(user, `select can_access_resource($1,'view') ok`, [res]))[0].ok as boolean;

/** Creates a pending payment for `user`, uploads a proof and submits it with `ref`. Returns the payment id. */
async function submitted(user: string, ref: string, plan = planMonthly): Promise<string> {
  const id = (await q(user, `select create_payment($1,'jazzcash') id`, [plan]))[0].id as string;
  const path = `${user}/${id}/proof.png`;
  await q(user, `insert into storage.objects (bucket_id,name) values ('payment-proofs',$1)`, [path]);
  await q(user, `select submit_payment($1,$2,$3,'paid via app')`, [id, ref, path]);
  return id;
}
const status = async (id: string) => (await db.query<{ status: string }>(`select status from payments where id=$1`, [id])).rows[0].status;
const entitlementsFor = async (payment: string) => (await db.query<any>(`select * from entitlements where payment_id=$1`, [payment])).rows;

beforeAll(async () => {
  db = await createDb();
  [admin, student, other] = await Promise.all(["admin", "student", "other"].map((n) => newUser(db, n)));
  await db.query(`insert into platform_admins (user_id) values ($1)`, [admin]);
  // Admin switches on one method and one plan, as the admin screens will.
  await q(admin, `update payment_methods set is_active=true, account_title='Ilm Academy', account_number='0000' where code='jazzcash'`);
  await q(admin, `update plans set is_active=true, price_paisa=250000 where code='premium-monthly'`);
  planMonthly = (await db.query<{ id: string }>(`select id from plans where code='premium-monthly'`)).rows[0].id;
  planYearly = (await db.query<{ id: string }>(`select id from plans where code='premium-yearly'`)).rows[0].id;
  // A premium book that is legally viewable (premium also needs allow_commercial), so access depends only on the entitlement.
  res = (await q(admin, `insert into resources (title,access_tier) values ('Premium Notes','premium') returning id`))[0].id;
  await q(admin, `update copyright_permissions set permission_status='approved', license_type='public_domain',
    evidence_reference='Public domain, pre-1900', allow_online_view=true, allow_commercial=true where resource_id=$1`, [res]);
  await q(admin, `update resources set status='published' where id=$1`, [res]);
});

describe("plans and prices", () => {
  it("visitors see only active plans", async () => {
    const codes = (await q(null, `select code from plans`)).map((r) => r.code);
    expect(codes).toEqual(["premium-monthly"]);
  });

  it("only a super admin can edit a plan", async () => {
    expect(await q(student, `update plans set price_paisa=1 where code='premium-monthly' returning id`)).toHaveLength(0);
    expect(await q(admin, `update plans set price_paisa=250000 where code='premium-monthly' returning id`)).toHaveLength(1);
  });

  it("an inactive plan or method cannot be bought", async () => {
    expect(await failure(student, `select create_payment($1,'jazzcash')`, [planYearly])).toMatch(/not available/);
    const pm = (await db.query<{ id: string }>(`select id from plans where code='premium-monthly'`)).rows[0].id;
    expect(await failure(student, `select create_payment($1,'easypaisa')`, [pm])).toMatch(/not available/);
  });

  it("the amount is the plan price; a client cannot write payments or pick the amount", async () => {
    const id = (await q(student, `select create_payment($1,'jazzcash') id`, [planMonthly]))[0].id;
    const row = (await q(student, `select amount_paisa, currency, status from payments where id=$1`, [id]))[0];
    expect(row).toMatchObject({ amount_paisa: 250000, currency: "PKR", status: "pending" });
    expect(await failure(student, `insert into payments (user_id,plan_id,plan_name,duration_months,method_code,amount_paisa) values ('${student}','${planMonthly}','x',1,'jazzcash',1)`)).toMatch(/permission denied/);
    expect(await failure(student, `update payments set amount_paisa=1, status='approved' where id='${id}'`)).toMatch(/permission denied/);
  });

  it("creating again reuses the unfinished payment", async () => {
    const a = (await q(student, `select create_payment($1,'jazzcash') id`, [planMonthly]))[0].id;
    const b = (await q(student, `select create_payment($1,'jazzcash') id`, [planMonthly]))[0].id;
    expect(a).toBe(b);
  });

  it("a later price change does not alter an existing payment, and is audited", async () => {
    const id = await submitted(other, "PRICE-CHANGE-1");
    await q(admin, `update plans set price_paisa=300000 where code='premium-monthly'`);
    expect((await q(other, `select amount_paisa from payments where id=$1`, [id]))[0].amount_paisa).toBe(250000);
    await q(admin, `update plans set price_paisa=250000 where code='premium-monthly'`);
    const log = await db.query(`select details from audit_logs where action='plan.updated'`);
    expect(log.rows.length).toBeGreaterThanOrEqual(2);
    await q(admin, `select reject_payment($1,'test cleanup')`, [id]);
  });
});

describe("who can review", () => {
  it("a student cannot approve or reject their own payment, or anyone else's", async () => {
    const id = await submitted(student, "OWN-PAY-0001");
    expect(await failure(student, `select approve_payment($1)`, [id])).toMatch(/Not allowed/);
    expect(await failure(student, `select reject_payment($1,'because')`, [id])).toMatch(/Not allowed/);
    expect(await failure(other, `select approve_payment($1)`, [id])).toMatch(/Not allowed/);
    expect(await status(id)).toBe("submitted");
    expect(await entitlementsFor(id)).toHaveLength(0);
    await q(admin, `select reject_payment($1,'test cleanup')`, [id]);
  });

  it("even a super admin cannot approve their own payment", async () => {
    const id = await submitted(admin, "ADMIN-OWN-001");
    expect(await failure(admin, `select approve_payment($1)`, [id])).toMatch(/own payment/);
    expect(await failure(admin, `select reject_payment($1,'nope')`, [id])).toMatch(/own payment/);
  });

  it("a student cannot read someone else's payment", async () => {
    const id = await submitted(student, "PRIVATE-PAY-1");
    expect(await q(other, `select id from payments where id=$1`, [id])).toHaveLength(0);
    expect(await q(student, `select id from payments where id=$1`, [id])).toHaveLength(1);
    expect(await q(admin, `select id from payments where id=$1`, [id])).toHaveLength(1);
    await q(admin, `select reject_payment($1,'test cleanup')`, [id]);
  });
});

describe("payment proofs", () => {
  it("only the owner and a super admin can read a proof; another student gets nothing", async () => {
    const id = await submitted(student, "PROOF-READ-01");
    const where = `bucket_id='payment-proofs' and name='${student}/${id}/proof.png'`;
    expect(await q(student, `select id from storage.objects where ${where}`)).toHaveLength(1);
    expect(await q(admin, `select id from storage.objects where ${where}`)).toHaveLength(1);
    expect(await q(other, `select id from storage.objects where ${where}`)).toHaveLength(0);
    expect(await q(null, `select id from storage.objects where ${where}`)).toHaveLength(0);
    await q(admin, `select reject_payment($1,'test cleanup')`, [id]);
  });

  it("a user can only upload into their own pending payment's folder", async () => {
    const id = (await q(other, `select create_payment($1,'jazzcash') id`, [planMonthly]))[0].id;
    // into someone else's folder
    expect(await failure(student, `insert into storage.objects (bucket_id,name) values ('payment-proofs','${other}/${id}/proof.png')`)).toMatch(/row-level security/);
    // into their own folder but for a payment that is not theirs
    expect(await failure(student, `insert into storage.objects (bucket_id,name) values ('payment-proofs','${student}/${id}/proof.png')`)).toMatch(/row-level security/);
    // the owner can
    expect(await failure(other, `insert into storage.objects (bucket_id,name) values ('payment-proofs','${other}/${id}/proof.png')`)).toBeNull();
  });

  it("no more uploads once the payment is submitted", async () => {
    const id = await submitted(student, "PROOF-LOCK-01");
    expect(await failure(student, `insert into storage.objects (bucket_id,name) values ('payment-proofs','${student}/${id}/other.png')`)).toMatch(/row-level security/);
    await q(admin, `select reject_payment($1,'test cleanup')`, [id]);
  });

  it("submit needs a real uploaded proof under the payer's own path", async () => {
    const id = (await q(student, `select create_payment($1,'jazzcash') id`, [planMonthly]))[0].id;
    expect(await failure(student, `select submit_payment($1,'REAL-REF-0001',null)`, [id])).toMatch(/screenshot/);
    expect(await failure(student, `select submit_payment($1,'REAL-REF-0001',$2)`, [id, `${student}/${id}/missing.png`])).toMatch(/screenshot/);
    expect(await failure(student, `select submit_payment($1,'REAL-REF-0001',$2)`, [id, `${other}/${id}/proof.png`])).toMatch(/screenshot/);
    expect(await failure(student, `select submit_payment($1,'ab',$2)`, [id, `${student}/${id}/proof.png`])).toMatch(/transaction ID/);
    expect(await failure(other, `select submit_payment($1,'REAL-REF-0001','x')`, [id])).toMatch(/not found/);
  });
});

describe("duplicate transaction IDs", () => {
  it("rejects the same ID, however it is typed, while the first payment is live", async () => {
    const first = await submitted(student, "TXN-998 877 66");
    const id = (await q(other, `select create_payment($1,'jazzcash') id`, [planMonthly]))[0].id;
    const path = `${other}/${id}/proof2.png`;
    await q(other, `insert into storage.objects (bucket_id,name) values ('payment-proofs',$1)`, [path]);
    expect(await failure(other, `select submit_payment($1,'txn99887766',$2)`, [id, path])).toMatch(/already been submitted/);
    expect(await status(id)).toBe("pending");
    // once the first is rejected the ID is free again (a mistake can be corrected)
    await q(admin, `select reject_payment($1,'unreadable screenshot')`, [first]);
    expect(await failure(other, `select submit_payment($1,'txn99887766',$2)`, [id, path])).toBeNull();
    await q(admin, `select reject_payment($1,'test cleanup')`, [id]);
  });

  it("the database also enforces it, not just the function", async () => {
    const a = await submitted(student, "UNIQUE-IDX-001");
    const b = (await q(other, `select create_payment($1,'jazzcash') id`, [planMonthly]))[0].id;
    const err = await failure(null, `select 1`); // anon no-op, keeps helper symmetric
    expect(err).toBeNull();
    await expect(db.query(`update payments set status='submitted', reference_norm='UNIQUEIDX001', proof_path='x' where id=$1`, [b])).rejects.toThrow(/duplicate key/);
    await q(admin, `select reject_payment($1,'test cleanup')`, [a]);
  });
});

describe("approval", () => {
  it("approving twice creates exactly one entitlement and returns the same one", async () => {
    const id = await submitted(student, "APPROVE-TWICE-1");
    const first = (await q(admin, `select approve_payment($1,'checked bank') e`, [id]))[0].e;
    const second = (await q(admin, `select approve_payment($1) e`, [id]))[0].e;
    expect(second).toBe(first);
    expect(await entitlementsFor(id)).toHaveLength(1);
    expect(await status(id)).toBe("approved");
    const ent = (await entitlementsFor(id))[0];
    expect(ent).toMatchObject({ user_id: student, scope: "platform", scope_id: null, source: "subscription", granted_by: admin });
    expect(ent.expires_at.getTime() - ent.starts_at.getTime()).toBeGreaterThan(27 * 86400_000);
    const audit = await db.query<any>(`select * from audit_logs where action='payment.approved' and entity_id=$1`, [id]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].details).toMatchObject({ amount_paisa: 250000, entitlement_id: first });
  });

  it("two approvals at once still produce one entitlement", async () => {
    const id = await submitted(other, "CONCURRENT-001");
    await Promise.allSettled([
      q(admin, `select approve_payment($1)`, [id]),
      q(admin, `select approve_payment($1)`, [id]),
    ]);
    expect(await entitlementsFor(id)).toHaveLength(1);
  });

  it("an approved payment cannot be rejected, and a rejected one cannot be approved", async () => {
    const approved = (await db.query<{ id: string }>(`select id from payments where reference_norm='APPROVETWICE1'`)).rows[0].id;
    expect(await failure(admin, `select reject_payment($1,'changed my mind')`, [approved])).toMatch(/Only a submitted/);
    const id = await submitted(student, "REJECT-FIRST-01");
    await q(admin, `select reject_payment($1,'blurry screenshot')`, [id]);
    await q(admin, `select reject_payment($1,'blurry screenshot')`, [id]); // idempotent
    expect(await failure(admin, `select approve_payment($1)`, [id])).toMatch(/Only a submitted/);
    expect(await entitlementsFor(id)).toHaveLength(0);
    const row = (await q(student, `select status, review_note from payments where id=$1`, [id]))[0];
    expect(row).toMatchObject({ status: "rejected", review_note: "blurry screenshot" });
  });

  it("rejecting needs a reason", async () => {
    const id = await submitted(other, "NEEDS-REASON-1");
    expect(await failure(admin, `select reject_payment($1,'')`, [id])).toMatch(/reason/);
    await q(admin, `select reject_payment($1,'test cleanup')`, [id]);
  });

  it("a payment can be taken for review first, and then approved", async () => {
    const id = await submitted(other, "REVIEW-FIRST-01");
    expect(await failure(student, `select claim_payment_review($1)`, [id])).toMatch(/Not allowed/);
    await q(admin, `select claim_payment_review($1)`, [id]);
    await q(admin, `select claim_payment_review($1)`, [id]); // idempotent
    expect(await status(id)).toBe("under_review");
    await q(admin, `select approve_payment($1)`, [id]);
    expect(await status(id)).toBe("approved");
  });
});

describe("premium access follows the entitlement", () => {
  it("a student without a payment cannot view a premium book; an approved payment unlocks it; expiry locks it again", async () => {
    const buyer = await newUser(db, "buyer");
    expect(await canView(buyer)).toBe(false);
    const id = await submitted(buyer, "ACCESS-FLOW-01");
    expect(await canView(buyer)).toBe(false); // submitted is not enough
    await q(admin, `select approve_payment($1)`, [id]);
    expect(await canView(buyer)).toBe(true);
    await db.query(`update entitlements set starts_at=now() - interval '40 days', expires_at=now() - interval '1 day' where payment_id=$1`, [id]);
    expect(await canView(buyer)).toBe(false);
  });

  it("a renewal starts when the current Premium ends", async () => {
    const buyer = await newUser(db, "renewer");
    const one = await submitted(buyer, "RENEW-ONE-0001");
    await q(admin, `select approve_payment($1)`, [one]);
    const two = await submitted(buyer, "RENEW-TWO-0001");
    await q(admin, `select approve_payment($1)`, [two]);
    const [a] = await entitlementsFor(one);
    const [b] = await entitlementsFor(two);
    expect(b.starts_at.getTime()).toBe(a.expires_at.getTime());
    expect(b.expires_at.getTime()).toBeGreaterThan(a.expires_at.getTime());
    expect(await canView(buyer)).toBe(true);
  });
});
