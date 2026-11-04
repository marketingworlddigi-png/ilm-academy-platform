import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { listActivePlans } from "@/modules/payments/queries";
import { formatPkr, periodLabel } from "@/modules/payments/format";
import { PlanAction } from "@/components/plan-action";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Badge, Button, Card, EmptyState } from "@/components/ui";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[locale]/pricing">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: "Pricing: Premium access to books and notes",
    description: "Free books stay free. Premium unlocks the books and notes marked Premium. Pay by bank transfer, JazzCash or Easypaisa.",
    alternates: alternatesFor(locale, "/pricing"),
  };
}

export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const plans = await listActivePlans(createPublicClient());
  const monthly = plans.find((p) => p.duration_months === 1);
  const yearly = plans.find((p) => p.duration_months === 12);
  const saving = monthly && yearly ? Math.round((1 - yearly.price_paisa / (monthly.price_paisa * 12)) * 100) : 0;
  return (
    <main>
      <section className="bg-ink text-white star-pattern">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:py-12">
          <div><Breadcrumbs tone="dark" crumbs={[{ label: "Home", path: href(locale) }, { label: "Pricing", path: href(locale, "/pricing") }]} /></div>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">Premium access</h1>
          <p className="mt-2 max-w-2xl text-white/80">Books and notes marked Free stay free with an account. Premium unlocks the ones marked Premium for as long as your plan lasts.</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10">
        {plans.length === 0 ? (
          <EmptyState title="Premium plans are not open yet." action={<Button href={href(locale, "/library")} variant="outline">Browse the free library</Button>}>
            Free books are available in the library now.
          </EmptyState>
        ) : (
          <ul className="grid gap-5 md:grid-cols-3">
            <Card as="li" className="flex flex-col p-6">
              <h2 className="text-lg font-semibold">Free</h2>
              <p className="mt-3 text-3xl font-bold">PKR 0</p>
              <p className="mt-3 text-sm text-muted">Every book and course marked Free, with an account.</p>
              <Button href={href(locale, "/signup")} variant="outline" className="mt-6">Create account</Button>
            </Card>
            {plans.map((p) => {
              const best = p.duration_months === 12;
              return (
                <li key={p.id} className={`flex flex-col rounded-[14px] border p-6 ${best ? "border-primary-dark bg-primary-dark text-white" : "border-line bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    {best && saving > 0 && <Badge tone="gold">Save ~{saving}%</Badge>}
                  </div>
                  <p className="mt-3 text-3xl font-bold">{formatPkr(p.price_paisa)} <span className={`text-base font-normal ${best ? "text-white/70" : "text-muted"}`}>{periodLabel(p.duration_months)}</span></p>
                  {p.description && <p className={`mt-3 text-sm ${best ? "text-white/80" : "text-muted"}`}>{p.description}</p>}
                  <PlanAction plan={{ id: p.id, name: p.name, duration_months: p.duration_months }} checkoutHref={href(locale, `/checkout/${p.code}`)} dark={best} />
                </li>
              );
            })}
          </ul>
        )}

        <section className="mt-14">
          <h2 className="text-2xl font-bold">How paying works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Choose", "Pick a plan and a payment method: bank transfer, JazzCash or Easypaisa."],
              ["Send", "Send the amount to the account details we show you and keep the receipt."],
              ["Submit", "Enter the transaction ID and upload a screenshot of the receipt."],
              ["Approved", "We check the payment. Once approved, Premium is active and you can follow the status under My payments."],
            ].map(([t, d], i) => (
              <Card as="li" key={t} className="p-5">
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary-dark text-sm font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </Card>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted">Your receipt is stored privately and is visible only to you and our payment reviewers. We do not collect card numbers.</p>
        </section>
      </div>
    </main>
  );
}
