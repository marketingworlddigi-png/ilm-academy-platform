import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { createPublicClient } from "@/lib/supabase/public";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
// A certificate is checked by whoever holds the code; search engines have no reason to list it.
export const metadata: Metadata = { title: "Certificate", robots: { index: false, follow: false } };

type Cert = { name: string; course: string; academy: string; issued_at: string; code: string };

export default async function CertificatePage({ params }: PageProps<"/[locale]/certificates/[code]">) {
  const { locale, code } = await params;
  if (!isLocale(locale)) notFound();
  const { data } = await createPublicClient().rpc("verify_certificate", { p_code: code });
  const c = data as Cert | null;

  if (!c) {
    return (
      <main className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="text-2xl font-bold">Certificate not found</h1>
        <p className="mt-3 text-muted">We have no valid certificate with the code <strong>{code.slice(0, 20)}</strong>. Check the code for typing mistakes. A withdrawn certificate also stops verifying.</p>
        <div className="mt-6"><Button href={href(locale)}>Back to home</Button></div>
      </main>
    );
  }
  const date = new Date(c.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary print:hidden" role="status">
        <span aria-hidden="true">✓</span> Valid certificate. Issued by {c.academy} on {date}.
      </p>
      <section className="rounded-[18px] border-4 border-double border-gold bg-white p-6 text-center shadow-sm sm:p-12 print:border-2 print:shadow-none" aria-label="Certificate of completion">
        <div className="flex justify-center"><Logo /></div>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.25em] text-muted">Certificate of completion</p>
        <p className="mt-6 text-muted">This certifies that</p>
        <h1 className="mt-2 break-words text-3xl font-bold text-primary-dark sm:text-5xl">{c.name}</h1>
        <p className="mt-6 text-muted">has completed every lesson and passed every quiz in</p>
        <h2 className="mt-2 break-words text-2xl font-bold sm:text-3xl">{c.course}</h2>
        <p className="mt-2 text-muted">offered by {c.academy}</p>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-line pt-4 text-sm text-muted sm:flex-row">
          <span>Issued {date}</span>
          <span>Certificate code <strong className="font-mono text-ink">{c.code}</strong></span>
        </div>
      </section>
      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <PrintButton />
        <Button href={href(locale, "/learn")} variant="outline">My learning</Button>
      </div>
      <p className="mt-4 text-sm text-muted print:hidden">Anyone can check this certificate at this address using the code.</p>
    </main>
  );
}
