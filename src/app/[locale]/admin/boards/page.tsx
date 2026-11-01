import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createBoard } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Boards | Admin", robots: { index: false, follow: false } };

export default async function BoardsPage({ params, searchParams }: PageProps<"/[locale]/admin/boards">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const { data: boards } = await supabase.from("boards").select("id, slug, name_en, name_ur, name_ar, status").order("sort_order").order("name_en");

  return (
    <main className="mx-auto max-w-5xl px-5 py-14">
      <h1 className="font-display text-3xl font-semibold">Educational boards</h1>
      <p className="mt-1 text-sm text-ink-soft">Boards, levels and subjects are data, not code. Add the boards you serve.</p>
      {notice && <p role="status" className="mt-4 rounded-lg border border-line bg-paper-2 p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger/40 p-3 text-sm text-danger">{error}</p>}

      <div className="mt-8 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-paper-2 text-start"><tr>
            <th className="p-3 text-start">Name (English)</th><th className="p-3 text-start">اردو</th><th className="p-3 text-start">العربية</th>
            <th className="p-3 text-start">Slug</th><th className="p-3 text-start">Status</th></tr></thead>
          <tbody>
            {(boards ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-ink-soft">No boards yet. Add the first one below.</td></tr>}
            {(boards ?? []).map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="p-3">{b.name_en}</td><td className="p-3" dir="rtl">{b.name_ur}</td><td className="p-3" dir="rtl">{b.name_ar}</td>
                <td className="p-3 text-ink-soft">{b.slug}</td><td className="p-3">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={createBoard} className="mt-10 grid gap-4 rounded-xl border border-line p-5 sm:grid-cols-2">
        <input type="hidden" name="locale" value={locale} />
        <h2 className="font-semibold sm:col-span-2">Add a board</h2>
        <div><label className="label" htmlFor="name_en">Name (English)</label><input className="field" id="name_en" name="name_en" required /></div>
        <div><label className="label" htmlFor="slug">Slug</label><input className="field" id="slug" name="slug" placeholder="e.g. wifaq-ul-madaris" required /></div>
        <div><label className="label" htmlFor="name_ur">Name (Urdu)</label><input className="field" id="name_ur" name="name_ur" dir="rtl" /></div>
        <div><label className="label" htmlFor="name_ar">Name (Arabic)</label><input className="field" id="name_ar" name="name_ar" dir="rtl" /></div>
        <div><label className="label" htmlFor="status">Status</label>
          <select className="field" id="status" name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option></select></div>
        <div className="flex items-end"><button className="btn btn-primary" type="submit">Save board</button></div>
      </form>
    </main>
  );
}
