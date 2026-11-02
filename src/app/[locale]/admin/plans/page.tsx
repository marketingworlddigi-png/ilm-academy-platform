import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { formatPkr } from "@/modules/payments/format";
import { Card, Field, Flash, flashFrom } from "@/components/admin/ui";
import { savePlan } from "../payment-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plans | Admin", robots: { index: false, follow: false } };

export default async function PlansPage({ params, searchParams }: PageProps<"/[locale]/admin/plans">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const { error, notice } = flashFrom(await searchParams);
  const { data: plans } = await supabase.from("plans").select("*").order("sort_order").order("duration_months");

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold">Plans</h1>
      <p className="mt-1 text-sm text-ink-soft">Prices are in rupees and always applied by the server. A plan is hidden from the pricing page until it is switched on. Changing a price never alters payments that already exist.</p>
      <Flash error={error} notice={notice} />
      {(plans ?? []).map((p) => (
        <Card key={p.id} title={`${p.name} (${p.duration_months === 1 ? "1 month" : `${p.duration_months} months`}, currently ${formatPkr(p.price_paisa)})`} className="mt-6">
          <form action={savePlan} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={p.id} />
            <Field label="Name" name="name" defaultValue={p.name} required />
            <Field label="Price (PKR)" name="price" type="number" defaultValue={p.price_paisa / 100} required hint="Whole rupees or with paisa, for example 2500 or 2499.50." />
            <Field label="Description" name="description" defaultValue={p.description} className="sm:col-span-2" />
            <Field label="Sort order" name="sort_order" type="number" defaultValue={p.sort_order} />
            <label className="flex items-center gap-2 text-sm sm:self-end"><input type="checkbox" name="is_active" defaultChecked={p.is_active} /> Show on the pricing page and allow purchase</label>
            <div><button className="btn btn-primary" type="submit">Save plan</button></div>
          </form>
        </Card>
      ))}
    </main>
  );
}
