import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { formatPkr, statusLabel } from "@/modules/payments/format";
import { formatDay, type PurchasePreview } from "@/modules/payments/purchase";
import { PROOF_BUCKET, isImageProof } from "@/modules/payments/proofs";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { approvePayment, claimPaymentReview, rejectPayment } from "../../payment-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment | Admin", robots: { index: false, follow: false } };

const when = (v: string | null) => (v ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

export default async function PaymentReview({ params, searchParams }: PageProps<"/[locale]/admin/payments/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !idSchema.safeParse(id).success) notFound();
  const { supabase, user } = await requireSuperAdmin(locale);
  const { error, notice } = flashFrom(await searchParams);
  const { data: p } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [{ data: profile }, { data: signed }, { data: log }, { data: others }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", p.user_id).maybeSingle(),
    // Short-lived link, issued with the admin's own session: the storage policy only lets super admins and the owner read proofs.
    p.proof_path ? supabase.storage.from(PROOF_BUCKET).createSignedUrl(p.proof_path, 300) : Promise.resolve({ data: null }),
    supabase.from("audit_logs").select("id, action, actor_id, details, created_at").eq("entity_type", "payment").eq("entity_id", p.id).order("id"),
    supabase.from("payments").select("id").eq("user_id", p.user_id).neq("id", p.id).eq("status", "approved"),
  ]);
  const reviewablePayment = p.status === "submitted" || p.status === "under_review";
  // Approved: the period actually granted. Waiting: what approval would grant, from the same database function approval uses.
  const [{ data: pvRows }, { data: granted }] = await Promise.all([
    reviewablePayment ? supabase.rpc("plan_purchase_preview", { p_user: p.user_id, p_plan: p.plan_id, p_months: p.duration_months }) : Promise.resolve({ data: null }),
    p.status === "approved" ? supabase.from("entitlements").select("starts_at, expires_at").eq("payment_id", p.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const pv = (Array.isArray(pvRows) ? pvRows[0] : pvRows) as PurchasePreview | undefined;
  const proofUrl = signed?.signedUrl ?? null;
  const own = p.user_id === user.id;
  const reviewable = p.status === "submitted" || p.status === "under_review";

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/admin/payments")}>All payments</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{p.plan_name}: {formatPkr(p.amount_paisa)}</h1>
      <p className="mt-1 text-sm text-ink-soft">Code <strong className="text-ink">{p.code}</strong> · {statusLabel(p.status)}</p>
      <Flash error={error} notice={notice} />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card title="Payment">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-ink-soft">Payer</dt><dd>{profile?.full_name ?? "Unnamed"}{own && " (you)"}</dd></div>
            <div><dt className="text-ink-soft">Method</dt><dd>{p.method_code.replace("_", " ")}</dd></div>
            <div><dt className="text-ink-soft">Transaction ID (as typed)</dt><dd className="font-mono">{p.reference ?? "Not submitted yet"}</dd></div>
            <div><dt className="text-ink-soft">Submitted</dt><dd>{when(p.submitted_at) || "Not yet"}</dd></div>
            {p.payer_note && <div><dt className="text-ink-soft">Payer note</dt><dd>{p.payer_note}</dd></div>}
            {pv && <div><dt className="text-ink-soft">Payer&apos;s current plan</dt><dd>{pv.current_plan_name && pv.current_ends_at ? `${pv.current_plan_name}, until ${formatDay(pv.current_ends_at)}` : "No active plan"}</dd></div>}
            {pv && <div><dt className="text-ink-soft">If approved now, the new period covers</dt><dd>{formatDay(pv.period_starts_at)} to {formatDay(pv.period_ends_at)}</dd></div>}
            {granted && <div><dt className="text-ink-soft">Period granted</dt><dd>{formatDay(granted.starts_at)} to {formatDay(granted.expires_at as string)}</dd></div>}
            {(others?.length ?? 0) > 0 && <div><dt className="text-ink-soft">Earlier approved payments by this payer</dt><dd>{others?.length}</dd></div>}
            {p.review_note && <div><dt className="text-ink-soft">Review note</dt><dd>{p.review_note}</dd></div>}
          </dl>
        </Card>

        <Card title="Proof">
          {!proofUrl ? <p className="text-sm text-ink-soft">No proof uploaded yet.</p> : isImageProof(p.proof_path) ? (
            <a href={proofUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofUrl} alt="Payment proof uploaded by the payer" className="max-h-96 w-full rounded-lg border border-line object-contain" />
            </a>
          ) : <a className="btn btn-ghost" href={proofUrl} target="_blank" rel="noopener noreferrer">Open proof (PDF)</a>}
          {proofUrl && <p className="mt-2 text-xs text-ink-soft">The link expires after a few minutes. Reload the page for a new one.</p>}
        </Card>
      </div>

      {reviewable && !own && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card title="Approve">
            <p className="text-sm text-ink-soft">Check the amount and transaction ID against the bank or wallet statement first. This grants Premium and cannot be undone here.</p>
            <form action={approvePayment} className="mt-3 space-y-3">
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={p.id} />
              <div><label className="label" htmlFor="note">Note (optional)</label><input className="field" id="note" name="note" maxLength={500} /></div>
              <button className="btn btn-primary" type="submit">Approve and grant Premium</button>
            </form>
            {p.status === "submitted" && (
              <form action={claimPaymentReview} className="mt-3">
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={p.id} />
                <button className="btn btn-ghost" type="submit">Mark as under review</button>
              </form>
            )}
          </Card>
          <Card title="Reject">
            <form action={rejectPayment} className="space-y-3">
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={p.id} />
              <div><label className="label" htmlFor="reason">Reason (the payer will see this)</label>
                <input className="field" id="reason" name="reason" required minLength={3} maxLength={500} /></div>
              <button className="btn btn-ghost text-danger" type="submit">Reject payment</button>
            </form>
          </Card>
        </div>
      )}
      {reviewable && own && <p className="mt-8 rounded-xl border border-line p-4 text-sm text-ink-soft">This is your own payment, so another administrator has to review it.</p>}

      <Card title="History" className="mt-8">
        <ul className="space-y-1 text-sm">
          {(log ?? []).length === 0 && <li className="text-ink-soft">No events yet.</li>}
          {(log ?? []).map((e) => <li key={e.id}><span className="text-ink-soft">{when(e.created_at)}</span> {e.action.replace("payment.", "").replaceAll("_", " ")}</li>)}
        </ul>
      </Card>
    </main>
  );
}
