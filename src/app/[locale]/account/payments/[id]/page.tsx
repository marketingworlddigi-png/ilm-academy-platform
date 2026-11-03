import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { formatPkr, statusLabel } from "@/modules/payments/format";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { PaymentProofForm } from "@/components/payment-proof-form";
import { submitPaymentProof } from "../../../payment-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

const date = (v: string) => new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function PaymentPage({ params, searchParams }: PageProps<"/[locale]/account/payments/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !idSchema.safeParse(id).success) notFound();
  const { supabase, user } = await requireUser(locale);
  const { error, notice } = flashFrom(await searchParams);
  // RLS: a user can only ever read their own payments, so someone else's id is simply "not found".
  const { data: p } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: method }, { data: ent }] = await Promise.all([
    supabase.from("payment_methods").select("label, account_title, account_number, instructions").eq("code", p.method_code).maybeSingle(),
    supabase.from("entitlements").select("starts_at, expires_at").eq("payment_id", p.id).maybeSingle(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/account/payments")}>My payments</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{p.plan_name}</h1>
      <p className="mt-1 text-sm text-ink-soft">Payment code <strong className="text-ink">{p.code}</strong> · {formatPkr(p.amount_paisa)} · {method?.label ?? p.method_code}</p>
      <Flash error={error} notice={notice} />
      <p className="mt-4"><span className="inline-block rounded-full border border-line px-3 py-1 text-sm font-semibold">{statusLabel(p.status)}</span></p>

      {p.status === "pending" && (
        <>
          <Card title={`1. Pay ${formatPkr(p.amount_paisa)}`} className="mt-6">
            <p className="text-sm text-ink-soft">
              {method?.account_title && <>Account title: <strong className="text-ink">{method.account_title}</strong><br /></>}
              {method?.account_number && <>Account / number: <strong className="text-ink">{method.account_number}</strong><br /></>}
              {method?.instructions && <span className="whitespace-pre-line">{method.instructions}</span>}
            </p>
            <p className="mt-3 text-sm text-ink-soft">If the app lets you add a note or reference, write <strong className="text-ink">{p.code}</strong> so we can match your payment. Send exactly {formatPkr(p.amount_paisa)}.</p>
          </Card>
          <Card title="2. Send us the proof" className="mt-6">
            <p className="text-sm text-ink-soft">Once you have paid, enter the transaction ID and upload a screenshot of the receipt.</p>
            <PaymentProofForm paymentId={p.id} paymentCode={p.code} userId={user.id} locale={locale} action={submitPaymentProof} />
          </Card>
        </>
      )}

      {(p.status === "submitted" || p.status === "under_review") && (
        <Card className="mt-6">
          <p className="text-sm text-ink-soft">
            We received your transaction ID <strong className="text-ink">{p.reference}</strong>{p.submitted_at ? ` on ${date(p.submitted_at)}` : ""}.
            We will check it and update this page. You do not need to submit it again.
          </p>
        </Card>
      )}

      {p.status === "approved" && (
        <Card className="mt-6">
          <p className="text-sm text-ink-soft">
            Approved. Premium is active{ent?.expires_at ? ` until ${date(ent.expires_at)}` : ""}.{" "}
            <Link className="font-semibold text-brand underline" href={href(locale, "/library")}>Browse the library</Link>
          </p>
        </Card>
      )}

      {p.status === "rejected" && (
        <Card className="mt-6">
          <p className="text-sm text-ink-soft">This payment was not accepted.</p>
          {p.review_note && <p className="mt-2 rounded-lg border border-line bg-paper-2 p-3 text-sm"><strong>Reason:</strong> {p.review_note}</p>}
          <p className="mt-3 text-sm"><Link className="font-semibold text-brand underline" href={href(locale, "/pricing")}>Start a new payment</Link></p>
        </Card>
      )}
    </main>
  );
}
