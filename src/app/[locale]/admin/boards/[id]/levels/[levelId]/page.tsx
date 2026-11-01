import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { Card, DeleteForm, Field, Flash, flashFrom, NameFields } from "@/components/admin/ui";
import { deleteLevel, setLevelSubjects, updateLevel } from "../../../../catalog-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Level | Admin", robots: { index: false, follow: false } };

export default async function LevelDetail({ params, searchParams }: PageProps<"/[locale]/admin/boards/[id]/levels/[levelId]">) {
  const { locale, id, levelId } = await params;
  if (!isLocale(locale) || !idSchema.safeParse(id).success || !idSchema.safeParse(levelId).success) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const { error, notice } = flashFrom(await searchParams);
  const [{ data: level }, { data: board }, { data: subjects }, { data: links }] = await Promise.all([
    supabase.from("levels").select("*").eq("id", levelId).eq("board_id", id).maybeSingle(),
    supabase.from("boards").select("id, name_en").eq("id", id).maybeSingle(),
    supabase.from("subjects").select("id, name_en, name_ur, status").order("sort_order").order("name_en"),
    supabase.from("level_subjects").select("subject_id").eq("level_id", levelId),
  ]);
  if (!level || !board) notFound();
  const linked = new Set((links ?? []).map((r) => r.subject_id));

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm">
        <Link className="text-ink-soft underline" href={href(locale, "/admin/boards")}>All boards</Link>{" / "}
        <Link className="text-ink-soft underline" href={href(locale, `/admin/boards/${board.id}`)}>{board.name_en}</Link>
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{level.name_en}</h1>
      <Flash error={error} notice={notice} />

      <Card title="Level details" className="mt-8">
        <form action={updateLevel} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={level.id} />
          <input type="hidden" name="board_id" value={board.id} />
          <NameFields v={level} />
          <Field label="Slug" name="slug" defaultValue={level.slug} required />
          <Field label="Sort order" name="sort_order" type="number" defaultValue={level.sort_order} />
          <div className="flex items-end"><button className="btn btn-primary" type="submit">Save changes</button></div>
        </form>
      </Card>

      <Card title="Subjects taught at this level" className="mt-8">
        {(subjects ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">No subjects exist yet. <Link className="underline" href={href(locale, "/admin/subjects")}>Create subjects first</Link>.</p>
        ) : (
          <form action={setLevelSubjects}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="level_id" value={level.id} />
            <input type="hidden" name="board_id" value={board.id} />
            <ul className="grid gap-2 sm:grid-cols-2">
              {(subjects ?? []).map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 rounded-lg border border-line p-3 text-sm">
                    <input type="checkbox" name="subject_id" value={s.id} defaultChecked={linked.has(s.id)} />
                    <span>{s.name_en}</span>
                    {s.name_ur && <span className="text-ink-soft" dir="rtl">{s.name_ur}</span>}
                    {s.status !== "published" && <span className="ms-auto text-xs text-ink-soft">{s.status}</span>}
                  </label>
                </li>
              ))}
            </ul>
            <button className="btn btn-primary mt-4" type="submit">Save subjects</button>
          </form>
        )}
      </Card>

      <DeleteForm action={deleteLevel} locale={locale} fields={{ id: level.id, board_id: board.id }} what="level" />
    </main>
  );
}
