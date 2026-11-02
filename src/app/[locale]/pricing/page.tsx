import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { alternatesFor } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";
import { listActivePlans } from "@/modules/payments/queries";
import { formatPkr, periodLabel } from "@/modules/payments/format";
import { Breadcrumbs } from "@/components/breadcrumbs";

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
  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <Breadcrumbs crumbs={[{ label: "Home", path: href(locale) }, { label: "Pricing", path: href(locale, "/pricing") }]} />
      <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">Premium access</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Books and notes marked Free stay free with an account. Premium unlocks the ones marked Premium for as long as your plan lasts.
      </p>

      {plans.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line p-6 text-ink-soft">
          Premium plans are not open yet. Free books are available in the <Link className="text-brand underline" href={href(locale, "/library")}>library</Link>.
        </p>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-col rounded-xl border border-line p-6">
              <h2 className="font-display text-xl font-semibold">{p.name}</h2>
              <p className="mt-3 text-3xl font-semibold">{formatPkr(p.price_paisa)} <span className="text-base font-normal text-ink-soft">{periodLabel(p.duration_months)}</span></p>
              {p.description && <p className="mt-3 text-sm text-ink-soft">{p.description}</p>}
              <Link className="btn btn-primary mt-6 self-start" href={href(locale, `/checkout/${p.code}`)}>Choose {p.name}</Link>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold">How paying works</h2>
        <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-ink-soft">
          <li>Choose a plan and a payment method (bank transfer, JazzCash or Easypaisa).</li>
          <li>Send the amount using the account details we show you, and keep the receipt.</li>
          <li>Enter the transaction ID and upload a screenshot of the receipt.</li>
          <li>We check the payment. Once approved, Premium is active on your account, and you can follow the status under My payments.</li>
        </ol>
        <p className="mt-4 text-sm text-ink-soft">Your receipt is stored privately and is visible only to you and our payment reviewers. We do not collect card numbers.</p>
      </section>
    </main>
  );
}
