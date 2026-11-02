import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { signOut, updateName } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

export default async function AccountPage({ params, searchParams }: PageProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const { supabase, user } = await requireUser(locale);
  const [{ data: profile }, { data: isAdmin }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.rpc("is_super_admin"),
    supabase.from("memberships").select("role, status, academies(name)").eq("user_id", user.id),
  ]);
  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="font-display text-3xl font-semibold">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
      <p className="mt-1 text-ink-soft">{user.email}</p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger/40 p-3 text-sm text-danger">{error}</p>}

      <section className="mt-8 rounded-xl border border-line p-5">
        <h2 className="font-semibold">Your roles</h2>
        <ul className="mt-2 list-disc ps-5 text-sm text-ink-soft">
        {isAdmin === true && <li>Platform administrator</li>}
          {(memberships ?? []).map((m, i) => (
            <li key={i}>{m.role.replace("_", " ")} ({m.status}){/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(m as any).academies?.name ? `: ${(m as any).academies.name}` : ""}</li>
          ))}
          {isAdmin !== true && (memberships ?? []).length === 0 && <li>Student (free account)</li>}
        </ul>
      </section>

      <form action={updateName} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line p-5">
        <input type="hidden" name="locale" value={locale} />
        <div className="min-w-60 flex-1"><label className="label" htmlFor="fullName">Your name</label>
          <input className="field" id="fullName" name="fullName" defaultValue={profile?.full_name ?? ""} autoComplete="name" required minLength={2} maxLength={120} /></div>
        <button className="btn btn-ghost" type="submit">Save</button>
      </form>

      <div className="mt-8 flex flex-wrap gap-3">
        {isAdmin === true && <Link className="btn btn-primary" href={href(locale, "/admin")}>Open admin</Link>}
        <Link className="btn btn-ghost" href={href(locale, "/account/payments")}>My payments</Link>
        <Link className="btn btn-ghost" href={href(locale, "/academy")}>My academies</Link>
        <form action={signOut}>
          <input type="hidden" name="locale" value={locale} />
          <button className="btn btn-ghost" type="submit">Sign out</button>
        </form>
      </div>
    </main>
  );
}
