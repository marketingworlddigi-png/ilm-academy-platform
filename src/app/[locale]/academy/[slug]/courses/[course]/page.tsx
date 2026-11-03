import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { COURSE_STATUS_LABEL } from "@/modules/courses/schemas";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { addLesson, addModule, deleteLesson, deleteModule, setCourseStatus, updateCourse, updateLesson } from "../../../../course-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Manage course", robots: { index: false, follow: false } };

export default async function ManageCourse({ params, searchParams }: PageProps<"/[locale]/academy/[slug]/courses/[course]">) {
  const { locale, slug, course } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireUser(locale);
  const { error, notice } = flashFrom(await searchParams);

  const { data: academy } = await supabase.from("academies").select("id, slug, name").eq("slug", slug).is("deleted_at", null).maybeSingle();
  if (!academy) notFound();
  const { data: mine } = await supabase.from("memberships").select("role").eq("academy_id", academy.id).eq("user_id", user.id).eq("status", "active").in("role", ["academy_owner", "academy_admin"]);
  if (!mine?.length) notFound();
  const { data: c } = await supabase.from("courses").select("id, slug, title, summary, description, status").eq("academy_id", academy.id).eq("slug", course).is("deleted_at", null).maybeSingle();
  if (!c) notFound();

  const [{ data: modules }, { data: lessons }, { data: books }] = await Promise.all([
    supabase.from("course_modules").select("id, title, position").eq("course_id", c.id).order("position"),
    supabase.from("lessons").select("id, module_id, title, body, is_preview, resource_id, position").eq("course_id", c.id).order("position"),
    supabase.from("resources").select("id, title").or(`academy_id.is.null,academy_id.eq.${academy.id}`).eq("status", "published").is("deleted_at", null).order("title").limit(200),
  ]);
  const hidden = (name = "course_id", value = c.id) => (<><input type="hidden" name="locale" value={locale} /><input type="hidden" name={name} value={value} /></>);
  const bookSelect = (current: string | null) => (
    <select className="field" name="resource_id" defaultValue={current ?? ""}>
      <option value="">No linked book</option>
      {(books ?? []).map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
    </select>
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, `/academy/${academy.slug}/courses`)}>All courses</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{c.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">Status: <strong className="text-ink">{COURSE_STATUS_LABEL[c.status] ?? c.status}</strong>
        {c.status === "published" && <> · <Link className="underline" href={href(locale, `/courses/${academy.slug}/${c.slug}`)}>View public page</Link></>}</p>
      <Flash error={error} notice={notice} />

      <div className="mt-4 flex flex-wrap gap-3">
        {c.status !== "published" && <form action={setCourseStatus}>{hidden("id")}<input type="hidden" name="status" value="published" /><button className="btn btn-primary" type="submit">Publish</button></form>}
        {c.status === "published" && <form action={setCourseStatus}>{hidden("id")}<input type="hidden" name="status" value="draft" /><button className="btn btn-ghost" type="submit">Unpublish</button></form>}
        {c.status !== "archived" && <form action={setCourseStatus}>{hidden("id")}<input type="hidden" name="status" value="archived" /><button className="btn btn-ghost" type="submit">Archive</button></form>}
      </div>

      <Card title="Details" className="mt-8">
        <form action={updateCourse} className="space-y-4">
          {hidden("id")}
          <div><label className="label" htmlFor="title">Title</label><input className="field" id="title" name="title" defaultValue={c.title} required minLength={3} maxLength={160} /></div>
          <div><label className="label" htmlFor="slug">Web address</label><input className="field" id="slug" name="slug" defaultValue={c.slug} required />
            {c.status === "published" && <p className="mt-1 text-xs text-ink-soft">Unpublish before changing the web address.</p>}</div>
          <div><label className="label" htmlFor="summary">Summary</label><input className="field" id="summary" name="summary" defaultValue={c.summary ?? ""} maxLength={300} /></div>
          <div><label className="label" htmlFor="description">Description</label><textarea className="field min-h-28" id="description" name="description" defaultValue={c.description ?? ""} maxLength={5000} /></div>
          <button className="btn btn-primary" type="submit">Save</button>
        </form>
      </Card>

      <h2 className="mt-10 font-display text-2xl font-semibold">Modules and lessons</h2>
      {(modules ?? []).map((m) => (
        <section key={m.id} className="mt-6 rounded-2xl border border-line p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{m.title}</h3>
            <form action={deleteModule}>{hidden("id", m.id)}<button className="btn btn-ghost text-sm" type="submit">Remove module</button></form>
          </div>
          {(lessons ?? []).filter((l) => l.module_id === m.id).map((l) => (
            <details key={l.id} className="mt-3 rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-sm font-semibold">{l.title}{l.is_preview ? " (free preview)" : ""}</summary>
              <form action={updateLesson} className="mt-3 space-y-3">
                {hidden("id", l.id)}
                <div><label className="label" htmlFor={`t-${l.id}`}>Title</label><input className="field" id={`t-${l.id}`} name="title" defaultValue={l.title} required minLength={2} maxLength={160} /></div>
                <div><label className="label" htmlFor={`b-${l.id}`}>Lesson text (plain text)</label><textarea className="field min-h-40" id={`b-${l.id}`} name="body" defaultValue={l.body ?? ""} maxLength={20000} /></div>
                <div><label className="label">Linked book</label>{bookSelect(l.resource_id)}</div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_preview" defaultChecked={l.is_preview} /> Free preview</label>
                  <label className="flex items-center gap-2 text-sm">Order <input className="field w-20" type="number" name="position" min={0} max={9999} defaultValue={l.position} /></label>
                </div>
                <button className="btn btn-primary" type="submit">Save lesson</button>
              </form>
              <form action={deleteLesson} className="mt-2">{hidden("id", l.id)}<button className="btn btn-ghost text-sm" type="submit">Delete lesson</button></form>
            </details>
          ))}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-brand">Add a lesson</summary>
            <form action={addLesson} className="mt-3 space-y-3">
              {hidden()}<input type="hidden" name="module_id" value={m.id} />
              <div><label className="label" htmlFor={`nt-${m.id}`}>Title</label><input className="field" id={`nt-${m.id}`} name="title" required minLength={2} maxLength={160} /></div>
              <div><label className="label" htmlFor={`nb-${m.id}`}>Lesson text (plain text)</label><textarea className="field min-h-32" id={`nb-${m.id}`} name="body" maxLength={20000} /></div>
              <div><label className="label">Linked book</label>{bookSelect(null)}</div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_preview" /> Free preview</label>
              <button className="btn btn-primary" type="submit">Add lesson</button>
            </form>
          </details>
        </section>
      ))}

      <Card title="Add a module" className="mt-8">
        <form action={addModule} className="flex flex-wrap items-end gap-3">
          {hidden()}
          <div className="min-w-60 flex-1"><label className="label" htmlFor="module-title">Module title</label><input className="field" id="module-title" name="title" required minLength={2} maxLength={160} /></div>
          <button className="btn btn-primary" type="submit">Add module</button>
        </form>
      </Card>
    </main>
  );
}
