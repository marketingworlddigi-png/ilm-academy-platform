import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { Card, DeleteForm, Field, Flash, flashFrom, NameFields, StatusSelect } from "@/components/admin/ui";
import { createLevel, deleteBoard, updateBoard } from "../../catalog-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Board | Admin", robots: { index: false, follow: false } };

export default async function BoardDetail({ params, searchParams }: PageProps<"/[locale]/admin/boards/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !idSchema.safeParse(id).success) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const { error, notice } = flashFrom(await searchParams);
  const [{ data: board }, { data: levels }] = await Promise.all([
    supabase.from("boards").select("*").eq("id", id).maybeSingle(),
    supabase.from("levels").select("id, slug, name_en, name_ur, name_ar, sort_order, level_subjects(count)").eq("board_id", id).order("sort_order").order("name_en"),
  ]);
  if (!board) notFound();

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/admin/boards")}>All boards</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{board.name_en}</h1>
      <Flash error={error} notice={notice} />

      <Card title="Board details" className="mt-8">
        <form action={updateBoard} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={board.id} />
          <NameFields v={board} />
          <Field label="Slug" name="slug" defaultValue={board.slug} required hint="Changing the slug changes public URLs." />
          <StatusSelect value={board.status} />
          <Field label="Sort order" name="sort_order" type="number" defaultValue={board.sort_order} />
          <div className="sm:col-span-2"><label className="label" htmlFor="description">Description</label>
            <textarea className="field" id="description" name="description" rows={3} defaultValue={board.description ?? ""} /></div>
          <div><button className="btn btn-primary" type="submit">Save changes</button></div>
        </form>
      </Card>

      <Card title="Levels" className="mt-8">
        <ul className="divide-y divide-line text-sm">
          {(levels ?? []).length === 0 && <li className="py-3 text-ink-soft">No levels yet (for example years, grades or stages). Add one below.</li>}
          {(levels ?? []).map((lv) => (
            <li key={lv.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <Link className="font-semibold text-brand underline" href={href(locale, `/admin/boards/${board.id}/levels/${lv.id}`)}>{lv.name_en}</Link>
              <span className="text-ink-soft" dir="rtl">{lv.name_ur}</span>
              <span className="text-ink-soft">{(lv.level_subjects as unknown as { count: number }[])?.[0]?.count ?? 0} subjects</span>
            </li>
          ))}
        </ul>
        <form action={createLevel} className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="board_id" value={board.id} />
          <h3 className="font-semibold sm:col-span-2">Add a level</h3>
          <NameFields />
          <Field label="Slug" name="slug" placeholder="e.g. year-1" required />
          <Field label="Sort order" name="sort_order" type="number" defaultValue={(levels ?? []).length + 1} />
          <div className="flex items-end"><button className="btn btn-primary" type="submit">Add level</button></div>
        </form>
      </Card>

      <DeleteForm action={deleteBoard} locale={locale} fields={{ id: board.id }} what="board" />
    </main>
  );
}
