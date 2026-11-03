import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { COURSE_STATUS_LABEL } from "@/modules/courses/schemas";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { createCourse } from "../../../course-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Courses", robots: { index: false, follow: false } };

export default async function AcademyCourses({ params, searchParams }: PageProps<"/[locale]/academy/[slug]/courses">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireUser(locale);
  const { error, notice } = flashFrom(await searchParams);

  const { data: academy } = await supabase.from("academies").select("id, slug, name, status").eq("slug", slug).is("deleted_at", null).maybeSingle();
  if (!academy) notFound();
  const { data: mine } = await supabase.from("memberships").select("role").eq("academy_id", academy.id).eq("user_id", user.id).eq("status", "active").in("role", ["academy_owner", "academy_admin"]);
  if (!mine?.length) notFound();

  const { data: courses } = await supabase.from("courses").select("id, slug, title, status").eq("academy_id", academy.id).is("deleted_at", null).order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, `/academy/${academy.slug}`)}>{academy.name}</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">Courses</h1>
      <Flash error={error} notice={notice} />
      {academy.status !== "active" && <p className="mt-4 rounded-xl border border-line bg-paper-2 p-4 text-sm">You can draft courses now. Publishing opens once your academy is approved.</p>}

      <Card title="New course" className="mt-8">
        <form action={createCourse} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="academy_id" value={academy.id} />
          <div><label className="label" htmlFor="title">Title</label><input className="field" id="title" name="title" required minLength={3} maxLength={160} /></div>
          <div><label className="label" htmlFor="slug">Web address</label><input className="field" id="slug" name="slug" required minLength={3} maxLength={60} placeholder="sarf-basics" />
            <p className="mt-1 text-xs text-ink-soft">Lowercase letters, numbers and hyphens.</p></div>
          <div className="sm:col-span-2"><button className="btn btn-primary" type="submit">Create draft</button></div>
        </form>
      </Card>

      <Card title="Your courses" className="mt-8">
        {(courses ?? []).length === 0 ? <p className="text-sm text-ink-soft">No courses yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {(courses ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                <Link className="font-semibold text-brand underline" href={href(locale, `/academy/${academy.slug}/courses/${c.slug}`)}>{c.title}</Link>
                <span className="text-ink-soft">{COURSE_STATUS_LABEL[c.status] ?? c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
