import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { getSessionUser } from "@/lib/auth/session";
import { loginUrl, signupUrl } from "@/lib/auth/return-path";
import { listActiveMethods } from "@/modules/payments/queries";
import { formatPkr, periodLabel } from "@/modules/payments/format";
import { formatDay, type PurchasePreview } from "@/modules/payments/purchase";
import { Flash, flashFrom } from "@/components/admin/ui";
import { startCheckout } from "../../payment-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage({ params, searchParams }: PageProps<"/[locale]/checkout/[plan]">) {
  const { locale, plan: code } = await params;
  if (!isLocale(locale) || !/^[a-z0-9-]{2,40}$/.test(code)) notFound();
  const here = href(locale, `/checkout/${code}`);
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <h1 className="font-display text-3xl font-semibold">Sign in to continue</h1>
        <p className="mt-2 text-ink-soft">You need an account so we can attach Premium to it.</p>
        <p className="mt-6 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href={loginUrl(locale, here)}>Sign in</Link>
          <Link className="btn btn-ghost" href={signupUrl(locale, here)}>Create account</Link>
        </p>
      </main>
    );
  }
  const [{ data: plan }, methods] = await Promise.all([
    supabase.from("plans").select("id, code, name, description, duration_months, price_paisa").eq("code", code).eq("is_active", true).maybeSingle(),
    listActiveMethods(supabase),
  ]);
  if (!plan) redirect(href(locale, "/pricing"));
  const { error, notice } = flashFrom(await searchParams);
  const { data: pvRows } = await supabase.rpc("plan_purchase_preview", { p_user: user.id, p_plan: plan.id });
  const pv = (Array.isArray(pvRows) ? pvRows[0] : pvRows) as PurchasePreview | undefined;

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/pricing")}>All plans</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{plan.name}</h1>
      <p className="mt-1 text-2xl font-semibold">{formatPkr(plan.price_paisa)} <span className="text-base font-normal text-ink-soft">{periodLabel(plan.duration_months)}</span></p>
      <Flash error={error} notice={notice} />
      {pv && (
        <div className="mt-6 rounded-xl border border-line p-4 text-sm">
          {pv.blocked && pv.same_plan_ends_at && pv.renew_from ? (
            <p>You already have {plan.name} until <strong>{formatDay(pv.same_plan_ends_at)}</strong>. You can renew it from <strong>{formatDay(pv.renew_from)}</strong>.</p>
          ) : (<>
            <p>This purchase covers <strong>{formatDay(pv.period_starts_at)}</strong> to <strong>{formatDay(pv.period_ends_at)}</strong>.</p>
            <p className="mt-1 text-ink-soft">
              {pv.current_plan_name && pv.current_ends_at
                ? `You have ${pv.current_plan_name} until ${formatDay(pv.current_ends_at)}. The new period starts when it ends, so you don't lose any days.`
                : "It starts when the payment is approved."}
              {" "}Dates follow Pakistan time and are confirmed when the payment is approved.
            </p>
          </>)}
        </div>
      )}

      {methods.length === 0 ? (
        <p className="mt-8 rounded-xl border border-line p-6 text-ink-soft">Payments are not open yet. Please check back soon.</p>
      ) : (
        <form action={startCheckout} className="mt-8 space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="plan_id" value={plan.id} />
          <input type="hidden" name="plan_code" value={plan.code} />
          <fieldset>
            <legend className="label">How will you pay?</legend>
            <div className="mt-2 space-y-3">
              {methods.map((m, i) => (
                <label key={m.code} className="block cursor-pointer rounded-xl border border-line p-4 has-[:checked]:border-brand">
                  <span className="flex items-center gap-3 font-semibold">
                    <input type="radio" name="method" value={m.code} required defaultChecked={i === 0} /> {m.label}
                  </span>
                  <span className="mt-2 block text-sm text-ink-soft">
                    {m.account_title && <>Account title: {m.account_title}<br /></>}
                    {m.account_number && <>Account / number: {m.account_number}<br /></>}
                    {m.instructions && <span className="whitespace-pre-line">{m.instructions}</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-sm text-ink-soft">Next you will get a payment code to quote, and a form for your transaction ID and receipt.</p>
          <button className="btn btn-primary" type="submit" disabled={pv?.blocked}>Continue</button>
        </form>
      )}
    </main>
  );
}
