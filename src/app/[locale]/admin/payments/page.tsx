import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatPkr, statusLabel } from "@/modules/payments/format";
import { Flash, flashFrom } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payments | Admin", robots: { index: false, follow: false } };

const FILTERS: Record<string, { label: string; statuses: string[] | null }> = {
  review: { label: "Needs review", statuses: ["submitted", "under_review"] },
  approved: { label: "Approved", statuses: ["approved"] },
  rejected: { label: "Rejected", statuses: ["rejected"] },
  pending: { label: "Awaiting payer", statuses: ["pending"] },
  all: { label: "All", statuses: null },
};
const when = (v: string | null) => (v ? new Date(v).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export default async function PaymentsQueue({ params, searchParams }: PageProps<"/[locale]/admin/payments">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const sp = await searchParams;
  const { error, notice } = flashFrom(sp);
  const key = typeof sp.show === "string" && sp.show in FILTERS ? sp.show : "review";

  let query = supabase.from("payments")
    .select("id, code, user_id, plan_name, amount_paisa, method_code, status, reference, submitted_at, created_at")
    .order("submitted_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(100);
  const statuses = FILTERS[key].statuses;
  if (statuses) query = query.in("status", statuses);
  const { data: payments } = await query;
  const ids = [...new Set((payments ?? []).map((p) => p.user_id))];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold">Payments</h1>
      <p className="mt-1 text-sm text-ink-soft">Oldest submissions first. Approving grants Premium; every decision is recorded in the audit log.</p>
      <Flash error={error} notice={notice} />
      <ul className="mt-6 flex flex-wrap gap-2 text-sm">
        {Object.entries(FILTERS).map(([k, f]) => (
          <li key={k}><Link href={`${href(locale, "/admin/payments")}?show=${k}`}
            className={`rounded-full border px-3 py-1 ${k === key ? "border-brand font-semibold text-brand" : "border-line text-ink-soft"}`}>{f.label}</Link></li>
        ))}
      </ul>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-paper-2"><tr>
            <th className="p-3 text-start">Submitted</th><th className="p-3 text-start">Payer</th><th className="p-3 text-start">Plan</th>
            <th className="p-3 text-start">Amount</th><th className="p-3 text-start">Reference</th><th className="p-3 text-start">Status</th></tr></thead>
          <tbody>
            {(payments ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">Nothing here.</td></tr>}
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="p-3">{when(p.submitted_at ?? p.created_at)}</td>
                <td className="p-3">{nameOf.get(p.user_id) ?? "Unnamed"}</td>
                <td className="p-3"><Link className="font-semibold text-brand underline" href={href(locale, `/admin/payments/${p.id}`)}>{p.plan_name}</Link>
                  <span className="block text-xs text-ink-soft">{p.code} · {p.method_code.replace("_", " ")}</span></td>
                <td className="p-3">{formatPkr(p.amount_paisa)}</td>
                <td className="p-3">{p.reference ?? ""}</td>
                <td className="p-3">{statusLabel(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
