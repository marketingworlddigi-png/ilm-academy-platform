import { beforeAll, describe, expect, it } from "vitest";
import { as, createDb, newUser, type Db } from "./harness";

let db: Db;
let admin: string, ownerA: string, buyer: string, member: string;
let academyA: string, platformBook: string, academyBook: string, plan: string;

const q = async (user: string | null, sql: string, params: unknown[] = []) =>
  as(db, user, async () => (await db.query(sql, params)).rows as any[]);
const failure = async (user: string | null, sql: string, params: unknown[] = []): Promise<string | null> => {
  try { await q(user, sql, params); return null; } catch (e) { return (e as Error).message; }
};
const can = async (user: string, res: string) => (await q(user, `select can_access_resource($1,'view') ok`, [res]))[0].ok as boolean;

async function publishedPremium(owner: string, academy: string | null, title: string): Promise<string> {
  const id = (await q(owner, `insert into resources (academy_id,title,access_tier) values ($1,$2,'premium') returning id`, [academy, title]))[0].id;
  await q(admin, `update copyright_permissions set permission_status='approved', license_type='public_domain',
    evidence_reference='Public domain', allow_online_view=true, allow_commercial=true where resource_id=$1`, [id]);
  await q(admin, `update resources set status='published' where id=$1`, [id]);
  return id;
}
async function approvedPayment(user: string, ref: string): Promise<string> {
  const id = (await q(user, `select create_payment($1,'jazzcash') id`, [plan]))[0].id as string;
  const path = `${user}/${id}/proof.png`;
  await q(user, `insert into storage.objects (bucket_id,name) values ('payment-proofs',$1)`, [path]);
  await q(user, `select submit_payment($1,$2,$3,null)`, [id, ref, path]);
  await q(admin, `select approve_payment($1,null)`, [id]);
  return id;
}

beforeAll(async () => {
  db = await createDb();
  [admin, ownerA, buyer, member] = await Promise.all(["admin", "ownerA", "buyer", "member"].map((n) => newUser(db, n)));
  await db.query(`insert into platform_admins (user_id) values ($1)`, [admin]);
  academyA = (await q(ownerA, `select register_academy('Academy A','academy-a') r`))[0].r;
  await db.exec(`update academies set status='active'`);
  platformBook = await publishedPremium(admin, null, "Platform Premium Book");
  academyBook = await publishedPremium(ownerA, academyA, "Academy Premium Book");
  await q(admin, `update payment_methods set is_active=true, account_number='0000', account_title='Ilm' where code='jazzcash'`);
  await q(admin, `update plans set is_active=true, price_paisa=250000 where code='premium-monthly'`);
  plan = (await db.query<{ id: string }>(`select id from plans where code='premium-monthly'`)).rows[0].id;
});

describe("platform Premium covers platform-owned resources only", () => {
  it("a platform subscriber opens platform premium books but not an academy's", async () => {
    await approvedPayment(buyer, "SCOPE-REF-1");
    expect(await can(buyer, platformBook)).toBe(true);
    expect(await can(buyer, academyBook)).toBe(false);
  });

  it("an academy-scoped entitlement opens that academy's premium books, and only that academy's", async () => {
    await db.query(`insert into entitlements (user_id,scope,scope_id,source) values ($1,'academy',$2,'purchase')`, [member, academyA]);
    expect(await can(member, academyBook)).toBe(true);
    expect(await can(member, platformBook)).toBe(false);
  });

  it("a resource entitlement still opens just that one academy book", async () => {
    const other = await newUser(db, "single");
    await db.query(`insert into entitlements (user_id,scope,scope_id,source) values ($1,'resource',$2,'purchase')`, [other, academyBook]);
    expect(await can(other, academyBook)).toBe(true);
  });

  it("an expired academy entitlement loses access", async () => {
    const lapsed = await newUser(db, "lapsed");
    await db.query(`insert into entitlements (user_id,scope,scope_id,source,starts_at,expires_at) values ($1,'academy',$2,'purchase', now()-interval '2 days', now()-interval '1 day')`, [lapsed, academyA]);
    expect(await can(lapsed, academyBook)).toBe(false);
  });
});

describe("ledger", () => {
  it("approval posts one balanced pair of entries in paisa", async () => {
    const user = await newUser(db, "ledger1");
    const id = await approvedPayment(user, "LEDGER-REF-1");
    const rows = (await db.query<any>(`select e.amount_paisa::int amt, a.code from ledger_entries e join ledger_accounts a on a.id=e.account_id where e.payment_id=$1 order by e.id`, [id])).rows;
    expect(rows).toEqual([{ amt: 250000, code: "platform:receipts" }, { amt: -250000, code: "platform:subscription_revenue" }]);
  });

  it("approving twice does not post again", async () => {
    const user = await newUser(db, "ledger2");
    const id = await approvedPayment(user, "LEDGER-REF-2");
    await q(admin, `select approve_payment($1,null)`, [id]);
    expect((await db.query(`select 1 from ledger_entries where payment_id=$1`, [id])).rows).toHaveLength(2);
  });

  it("rejected payments post nothing", async () => {
    const user = await newUser(db, "ledger3");
    const id = (await q(user, `select create_payment($1,'jazzcash') id`, [plan]))[0].id as string;
    const path = `${user}/${id}/proof.png`;
    await q(user, `insert into storage.objects (bucket_id,name) values ('payment-proofs',$1)`, [path]);
    await q(user, `select submit_payment($1,'LEDGER-REF-3',$2,null)`, [id, path]);
    await q(admin, `select reject_payment($1,'Amount does not match')`, [id]);
    expect((await db.query(`select 1 from ledger_entries where payment_id=$1`, [id])).rows).toHaveLength(0);
  });

  it("the whole ledger nets to zero", async () => {
    expect((await db.query<any>(`select coalesce(sum(amount_paisa),0)::int s from ledger_entries`)).rows[0].s).toBe(0);
  });

  it("rows cannot be updated, deleted or truncated, even by the database owner", async () => {
    expect((await failure(null, `select 1`)) ?? "").toBe("");
    await expect(db.exec(`update ledger_entries set amount_paisa = 1`)).rejects.toThrow(/cannot be changed/);
    await expect(db.exec(`delete from ledger_entries`)).rejects.toThrow(/cannot be changed/);
    await expect(db.exec(`truncate ledger_entries`)).rejects.toThrow(/cannot be changed/);
  });

  it("an unbalanced transaction is refused at commit", async () => {
    const acct = (await db.query<any>(`select id from ledger_accounts where code='platform:receipts'`)).rows[0].id;
    await expect(db.exec(`insert into ledger_entries (txn_id,account_id,amount_paisa,entry_type) values (gen_random_uuid(),'${acct}',100,'payment_received')`))
      .rejects.toThrow(/does not balance/);
  });

  it("clients cannot write the ledger or call the posting function", async () => {
    const acct = (await db.query<any>(`select id from ledger_accounts where code='platform:receipts'`)).rows[0].id;
    expect(await failure(buyer, `insert into ledger_entries (txn_id,account_id,amount_paisa,entry_type) values (gen_random_uuid(),'${acct}',1,'payment_received')`)).toMatch(/permission denied/);
    expect(await failure(admin, `insert into ledger_entries (txn_id,account_id,amount_paisa,entry_type) values (gen_random_uuid(),'${acct}',1,'payment_received')`)).toMatch(/permission denied/);
    expect(await failure(admin, `select post_payment_ledger(gen_random_uuid(), null)`)).toMatch(/permission denied/);
  });

  it("only super admins read platform ledger rows", async () => {
    expect(await q(buyer, `select 1 from ledger_entries`)).toHaveLength(0);
    expect(await q(ownerA, `select 1 from ledger_entries`)).toHaveLength(0);
    expect(await q(ownerA, `select 1 from ledger_accounts`)).toHaveLength(0);
    expect((await q(admin, `select 1 from ledger_entries`)).length).toBeGreaterThan(0);
  });
});
