import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { Flash, flashFrom } from "@/components/admin/ui";
import { revokeCertificate } from "../../../certificate-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certificates", robots: { index: false, follow: false } };

export default async function AcademyCertificates({ params, searchParams }: PageProps<"/[locale]/academy/[slug]/certificates">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireUser(locale);
  const { error, notice } = flashFrom(await searchParams);

  const { data: academy } = await supabase.from("academies").select("id, slug, name").eq("slug", slug).is("deleted_at", null).maybeSingle();
  if (!academy) notFound();
  const { data: mine } = await supabase.from("memberships").select("role").eq("academy_id", academy.id).eq("user_id", user.id).eq("status", "active").in("role", ["academy_owner", "academy_admin"]);
  if (!mine?.length) notFound();

  const { data: certs } = await supabase.from("certificates")
    .select("id, code, recipient_name, course_title, issued_at, revoked_at").eq("academy_id", academy.id).order("issued_at", { ascending: false }).limit(200);
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, `/academy/${academy.slug}`)}>{academy.name}</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Certificates</h1>
      <p className="mt-1 text-sm text-ink-soft">Withdrawing a certificate stops its code from verifying. The reason is kept in the audit log.</p>
      <Flash error={error} notice={notice} />
      {(certs ?? []).length === 0 && <p className="mt-6 text-ink-soft">No certificates have been issued yet.</p>}
      <ul className="mt-6 space-y-3">
        {(certs ?? []).map((c) => (
          <li key={c.id} className="rounded-xl border border-line p-4">
            <p className="font-semibold">{c.recipient_name} <span className="font-normal text-ink-soft">· {c.course_title}</span></p>
            <p className="text-sm text-ink-soft">
              Issued {fmt(c.issued_at)} · <Link className="font-mono underline" href={href(locale, `/certificates/${c.code}`)}>{c.code}</Link>
              {c.revoked_at && <strong className="text-danger"> · withdrawn {fmt(c.revoked_at)}</strong>}
            </p>
            {!c.revoked_at && (
              <form action={revokeCertificate} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="academy" value={academy.slug} /><input type="hidden" name="code" value={c.code} />
                <div><label className="label" htmlFor={`r-${c.id}`}>Reason for withdrawing</label><input className="field" id={`r-${c.id}`} name="reason" required minLength={3} maxLength={300} /></div>
                <button className="btn btn-ghost" type="submit">Withdraw</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
