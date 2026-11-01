import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { getSessionUser } from "@/lib/auth/session";
import { setNewPassword } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ params, searchParams }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // The emailed link signs the user in via /auth/callback; without that session there is nothing to reset.
  const { user } = await getSessionUser();
  if (!user) redirect(`${href(locale, "/forgot-password")}?error=${encodeURIComponent("That reset link is invalid or has expired. Request a new one.")}`);
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-display text-3xl font-semibold">Choose a new password</h1>
      <p className="mt-2 text-sm text-ink-soft">For {user.email}. Use at least 10 characters.</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger/40 p-3 text-sm text-danger">{error}</p>}
      <form action={setNewPassword} className="mt-6 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div><label className="label" htmlFor="password">New password</label>
          <input className="field" id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} /></div>
        <div><label className="label" htmlFor="confirm">Confirm new password</label>
          <input className="field" id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={72} /></div>
        <button className="btn btn-primary w-full" type="submit">Update password</button>
      </form>
      <p className="mt-6 text-sm text-ink-soft"><Link className="underline" href={href(locale, "/login")}>Cancel</Link></p>
    </main>
  );
}
