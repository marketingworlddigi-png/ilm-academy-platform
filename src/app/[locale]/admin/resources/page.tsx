import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { createResource } from "../resource-actions";
import { ResourceFields } from "./resource-fields";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resources | Admin", robots: { index: false, follow: false } };

export default async function ResourcesPage({ params, searchParams }: PageProps<"/[locale]/admin/resources">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const { error, notice } = flashFrom(await searchParams);
  const [{ data: resources }, { data: boards }, { data: levels }, { data: links }] = await Promise.all([
    supabase.from("resources").select("id, title, kind, status, access_tier, copyright_permissions(permission_status)")
      .is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    supabase.from("boards").select("id, name_en").order("sort_order").order("name_en"),
    supabase.from("levels").select("id, board_id, name_en").order("sort_order").order("name_en"),
    supabase.from("level_subjects").select("level_id, subjects(id, name_en)"),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold">Resources</h1>
      <p className="mt-1 text-sm text-ink-soft">Books and files. Nothing is public until its distribution permission is approved and it is published.</p>
      <Flash error={error} notice={notice} />

      <div className="mt-8 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-paper-2"><tr>
            <th className="p-3 text-start">Title</th><th className="p-3 text-start">Type</th><th className="p-3 text-start">Tier</th>
            <th className="p-3 text-start">Permission</th><th className="p-3 text-start">Status</th></tr></thead>
          <tbody>
            {(resources ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ink-soft">No resources yet.</td></tr>}
            {(resources ?? []).map((r) => {
              const p = Array.isArray(r.copyright_permissions) ? r.copyright_permissions[0] : r.copyright_permissions;
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="p-3"><Link className="font-semibold text-brand underline" href={href(locale, `/admin/resources/${r.id}`)}>{r.title}</Link></td>
                  <td className="p-3">{r.kind}</td><td className="p-3">{r.access_tier}</td>
                  <td className="p-3">{p?.permission_status?.replaceAll("_", " ") ?? "none"}</td><td className="p-3">{r.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Card title="Add a resource" className="mt-10">
        <form action={createResource} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <ResourceFields boards={boards ?? []} levels={levels ?? []} links={links ?? []} />
          <div className="flex items-end"><button className="btn btn-primary" type="submit">Create draft</button></div>
        </form>
      </Card>
    </main>
  );
}
