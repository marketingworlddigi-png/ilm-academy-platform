import Link from "next/link";
import type { Metadata } from "next";
import { href, isLocale } from "@/lib/i18n/config";
import { notFound } from "next/navigation";
import { login } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-display text-3xl font-semibold">Sign in</h1>
      {notice && <p role="status" className="mt-4 rounded-lg border border-line bg-paper-2 p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger/40 p-3 text-sm text-danger">{error}</p>}
      <form action={login} className="mt-6 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div><label className="label" htmlFor="email">Email</label>
          <input className="field" id="email" name="email" type="email" autoComplete="email" required /></div>
        <div><label className="label" htmlFor="password">Password</label>
          <input className="field" id="password" name="password" type="password" autoComplete="current-password" required /></div>
        <button className="btn btn-primary w-full" type="submit">Sign in</button>
      </form>
      <p className="mt-6 text-sm text-ink-soft">New here? <Link className="font-semibold text-brand underline" href={href(locale, "/signup")}>Create an account</Link></p>
    </main>
  );
}
