import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { ACADEMY_STATUS_LABEL } from "@/modules/academies/schemas";
import { Flash, flashFrom } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My academies", robots: { index: false, follow: false } };

export default async function MyAcademiesPage({ params, searchParams }: PageProps<"/[locale]/academy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireUser(locale);
  const { error, notice } = flashFrom(await searchParams);
  // Only the academies this person runs; being a student somewhere does not give a management page.
  const { data: staff } = await supabase.from("memberships").select("academy_id, role")
    .eq("user_id", user.id).eq("status", "active").in("role", ["academy_owner", "academy_admin"]);
  const ids = (staff ?? []).map((m) => m.academy_id);
  const { data: academies } = ids.length
    ? await supabase.from("academies").select("id, slug, name, status").in("id", ids).is("deleted_at", null).order("created_at", { ascending: false })
    : { data: [] };
  const roleOf = new Map((staff ?? []).map((m) => [m.academy_id, m.role]));

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/account")}>My account</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">My academies</h1>
      <Flash error={error} notice={notice} />
      {(academies ?? []).length === 0 ? (
        <p className="mt-6 text-ink-soft">You do not run an academy yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line">
          {(academies ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <Link className="font-semibold text-brand underline" href={href(locale, `/academy/${a.slug}`)}>{a.name}</Link>
                <p className="text-xs text-ink-soft">{roleOf.get(a.id) === "academy_owner" ? "Owner" : "Administrator"}</p>
              </div>
              <span className="rounded-full border border-line px-3 py-1 text-sm">{ACADEMY_STATUS_LABEL[a.status] ?? a.status}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8"><Link className="btn btn-primary" href={href(locale, "/academy/register")}>Register an academy</Link></p>
    </main>
  );
}
