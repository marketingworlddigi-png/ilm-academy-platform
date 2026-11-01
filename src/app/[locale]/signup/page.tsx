import Link from "next/link";
import type { Metadata } from "next";
import { href, isLocale } from "@/lib/i18n/config";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { signup } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };

export default async function SignupPage({ params, searchParams }: PageProps<"/[locale]/signup">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { user } = await getSessionUser();
  if (user) redirect(href(locale, "/account"));
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-display text-3xl font-semibold">Create your free account</h1>
      <p className="mt-2 text-sm text-ink-soft">We will email you a link to confirm your address.</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger/40 p-3 text-sm text-danger">{error}</p>}
      <form action={signup} className="mt-6 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div><label className="label" htmlFor="fullName">Full name</label>
          <input className="field" id="fullName" name="fullName" autoComplete="name" required minLength={2} /></div>
        <div><label className="label" htmlFor="email">Email</label>
          <input className="field" id="email" name="email" type="email" autoComplete="email" required /></div>
        <div><label className="label" htmlFor="password">Password (10+ characters)</label>
          <input className="field" id="password" name="password" type="password" autoComplete="new-password" required minLength={10} /></div>
        <button className="btn btn-primary w-full" type="submit">Create account</button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">Already registered? <Link className="font-semibold text-brand underline" href={href(locale, "/login")}>Sign in</Link></p>
    </main>
  );
}
