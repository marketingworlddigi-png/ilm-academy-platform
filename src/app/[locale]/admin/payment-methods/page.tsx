import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { Card, Field, Flash, flashFrom } from "@/components/admin/ui";
import { saveMethod } from "../payment-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment methods | Admin", robots: { index: false, follow: false } };

export default async function PaymentMethodsPage({ params, searchParams }: PageProps<"/[locale]/admin/payment-methods">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const { error, notice } = flashFrom(await searchParams);
  const { data: methods } = await supabase.from("payment_methods").select("*").order("sort_order");

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold">Payment methods</h1>
      <p className="mt-1 text-sm text-ink-soft">These details are shown to a signed-in payer at checkout. Only switch a method on once the account really exists and you can check incoming payments.</p>
      <Flash error={error} notice={notice} />
      {(methods ?? []).map((m) => (
        <Card key={m.code} title={`${m.label}${m.is_active ? " (on)" : " (off)"}`} className="mt-6">
          <form action={saveMethod} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="code" value={m.code} />
            <Field label="Account title" name="account_title" defaultValue={m.account_title} />
            <Field label="Account number / IBAN / wallet number" name="account_number" defaultValue={m.account_number} />
            <div className="sm:col-span-2">
              <label className="label" htmlFor={`ins-${m.code}`}>Instructions shown to the payer</label>
              <textarea className="field min-h-24" id={`ins-${m.code}`} name="instructions" defaultValue={m.instructions ?? ""} maxLength={1500} />
            </div>
            <Field label="Sort order" name="sort_order" type="number" defaultValue={m.sort_order} />
            <label className="flex items-center gap-2 text-sm sm:self-end"><input type="checkbox" name="is_active" defaultChecked={m.is_active} /> Offer this method at checkout</label>
            <div><button className="btn btn-primary" type="submit">Save</button></div>
          </form>
        </Card>
      ))}
    </main>
  );
}
