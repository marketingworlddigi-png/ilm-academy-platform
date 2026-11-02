import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { formatPkr, statusLabel } from "@/modules/payments/format";
import { Flash, flashFrom } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My payments", robots: { index: false, follow: false } };

const date = (v: string) => new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function MyPaymentsPage({ params, searchParams }: PageProps<"/[locale]/account/payments">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireUser(locale);
  const { error, notice } = flashFrom(await searchParams);
  const [{ data: payments }, { data: premium }] = await Promise.all([
    supabase.from("payments").select("id, code, plan_name, amount_paisa, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    // RLS lets a user read only their own entitlements. The window check mirrors has_entitlement().
    supabase.from("entitlements").select("expires_at").eq("user_id", user.id).eq("scope", "platform").is("revoked_at", null)
      .lte("starts_at", new Date().toISOString()).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("expires_at", { ascending: false, nullsFirst: true }).limit(1),
  ]);
  const active = premium?.[0];

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/account")}>My account</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">My payments</h1>
      <Flash error={error} notice={notice} />

      <section className="mt-6 rounded-xl border border-line p-5">
        <h2 className="font-semibold">Premium</h2>
        {active ? (
          <p className="mt-1 text-sm text-ink-soft">Active{active.expires_at ? ` until ${date(active.expires_at)}` : " with no end date"}.</p>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">Not active. <Link className="font-semibold text-brand underline" href={href(locale, "/pricing")}>See plans</Link></p>
        )}
      </section>

      <div className="mt-8 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-paper-2"><tr>
            <th className="p-3 text-start">Date</th><th className="p-3 text-start">Plan</th><th className="p-3 text-start">Amount</th><th className="p-3 text-start">Status</th></tr></thead>
          <tbody>
            {(payments ?? []).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-ink-soft">No payments yet.</td></tr>}
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="p-3">{date(p.created_at)}</td>
                <td className="p-3"><Link className="font-semibold text-brand underline" href={href(locale, `/account/payments/${p.id}`)}>{p.plan_name}</Link>
                  <span className="block text-xs text-ink-soft">{p.code}</span></td>
                <td className="p-3">{formatPkr(p.amount_paisa)}</td>
                <td className="p-3">{statusLabel(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
