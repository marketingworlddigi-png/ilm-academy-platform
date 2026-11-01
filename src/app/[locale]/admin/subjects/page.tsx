import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { Card, Field, Flash, flashFrom, NameFields, StatusSelect } from "@/components/admin/ui";
import { createSubject } from "../catalog-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subjects | Admin", robots: { index: false, follow: false } };

export default async function SubjectsPage({ params, searchParams }: PageProps<"/[locale]/admin/subjects">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const { error, notice } = flashFrom(await searchParams);
  const { data: subjects } = await supabase.from("subjects").select("id, slug, name_en, name_ur, name_ar, status").order("sort_order").order("name_en");

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold">Subjects</h1>
      <p className="mt-1 text-sm text-ink-soft">A subject is created once, then attached to the levels that teach it (open a level to do that).</p>
      <Flash error={error} notice={notice} />

      <div className="mt-8 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-paper-2"><tr>
            <th className="p-3 text-start">Name</th><th className="p-3 text-start">اردو</th><th className="p-3 text-start">العربية</th>
            <th className="p-3 text-start">Slug</th><th className="p-3 text-start">Status</th></tr></thead>
          <tbody>
            {(subjects ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ink-soft">No subjects yet.</td></tr>}
            {(subjects ?? []).map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="p-3"><Link className="font-semibold text-brand underline" href={href(locale, `/admin/subjects/${s.id}`)}>{s.name_en}</Link></td>
                <td className="p-3" dir="rtl">{s.name_ur}</td><td className="p-3" dir="rtl">{s.name_ar}</td>
                <td className="p-3 text-ink-soft">{s.slug}</td><td className="p-3">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card title="Add a subject" className="mt-10">
        <form action={createSubject} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <NameFields />
          <Field label="Slug" name="slug" placeholder="e.g. nahw" required />
          <StatusSelect />
          <Field label="Sort order" name="sort_order" type="number" defaultValue={0} />
          <div className="flex items-end"><button className="btn btn-primary" type="submit">Save subject</button></div>
        </form>
      </Card>
    </main>
  );
}
