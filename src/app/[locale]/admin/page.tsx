import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

async function count(supabase: Awaited<ReturnType<typeof requireSuperAdmin>>["supabase"], table: string) {
  const { count: n } = await supabase.from(table).select("*", { count: "exact", head: true });
  return n ?? 0;
}

export default async function AdminHome({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  // Real counts from the database; zero is shown as zero.
  const [boards, academies, resources, pending] = await Promise.all([
    count(supabase, "boards"), count(supabase, "academies"), count(supabase, "resources"),
    supabase.from("academies").select("*", { count: "exact", head: true }).eq("status", "pending").then((r) => r.count ?? 0),
  ]);
  const stats = [["Boards", boards], ["Academies", academies], ["Pending academy applications", pending], ["Resources", resources]] as const;
  return (
    <main className="mx-auto max-w-5xl px-5 py-14">
      <h1 className="font-display text-3xl font-semibold">Platform admin</h1>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-xl border border-line p-5">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{n}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8"><Link className="btn btn-primary" href={href(locale, "/admin/boards")}>Manage boards</Link></div>
    </main>
  );
}
