import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { ACADEMY_STATUS_LABEL } from "@/modules/academies/schemas";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { resubmitAcademy, updateAcademyProfile } from "../../academy-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Academy dashboard", robots: { index: false, follow: false } };

const ROLE_LABEL: Record<string, string> = { academy_owner: "Owner", academy_admin: "Administrators", instructor: "Teachers", student: "Students" };

export default async function AcademyDashboard({ params, searchParams }: PageProps<"/[locale]/academy/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase, user } = await requireUser(locale);
  const { error, notice } = flashFrom(await searchParams);

  const { data: academy } = await supabase.from("academies").select("id, slug, name, description, status, status_note, created_at").eq("slug", slug).is("deleted_at", null).maybeSingle();
  if (!academy) notFound();
  // The dashboard is for staff only. RLS also lets students see an active academy's row, so check the role explicitly.
  const { data: mine } = await supabase.from("memberships").select("role").eq("academy_id", academy.id).eq("user_id", user.id).eq("status", "active").in("role", ["academy_owner", "academy_admin"]);
  if (!mine?.length) notFound();

  const [{ data: members }, { data: resources }] = await Promise.all([
    supabase.from("memberships").select("role").eq("academy_id", academy.id).eq("status", "active"),
    supabase.from("resources").select("id, title, status, access_tier").eq("academy_id", academy.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
  ]);
  const count = (role: string) => (members ?? []).filter((m) => m.role === role).length;
  const live = academy.status === "active";
  const isOwner = mine.some((m) => m.role === "academy_owner");
  const canResubmit = isOwner && (academy.status === "needs_info" || academy.status === "rejected");

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/academy")}>My academies</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{academy.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">/{academy.slug} · <strong className="text-ink">{ACADEMY_STATUS_LABEL[academy.status] ?? academy.status}</strong></p>
      <Flash error={error} notice={notice} />

      {!live && (
        <p className="mt-4 rounded-xl border border-line bg-paper-2 p-4 text-sm">
          {academy.status === "pending" && "Your academy is waiting for review. Students cannot see it or its content until it is approved."}
          {academy.status === "needs_info" && "The reviewer needs more information before approving your academy."}
          {academy.status === "rejected" && "Your academy was not approved."}
          {academy.status === "suspended" && "Your academy is suspended. Its content is hidden from students."}
          {academy.status_note && <span className="mt-2 block"><strong>Note from the reviewer:</strong> {academy.status_note}</span>}
        </p>
      )}
      {canResubmit && (
        <form action={resubmitAcademy} className="mt-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={academy.id} />
          <p className="mb-2 text-sm text-ink-soft">Update the details below, then send it back for review.</p>
          <button className="btn btn-primary" type="submit">Resubmit for review</button>
        </form>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        {(["student", "instructor", "academy_admin", "academy_owner"] as const).map((r) => (
          <div key={r} className="rounded-xl border border-line p-4"><p className="text-2xl font-semibold">{count(r)}</p><p className="text-sm text-ink-soft">{ROLE_LABEL[r]}</p></div>
        ))}
      </div>

      <Card title="Academy details" className="mt-8">
        <form action={updateAcademyProfile} className="space-y-4">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={academy.id} />
          <div><label className="label" htmlFor="name">Name</label><input className="field" id="name" name="name" defaultValue={academy.name} required minLength={2} maxLength={120} /></div>
          <div><label className="label" htmlFor="description">Description</label>
            <textarea className="field min-h-28" id="description" name="description" defaultValue={academy.description ?? ""} maxLength={2000} /></div>
          <button className="btn btn-primary" type="submit">Save</button>
        </form>
      </Card>

      <Card title="Courses" className="mt-8">
        <p className="text-sm text-ink-soft">Write courses made of modules and lessons, and publish them for students to enroll.</p>
        <p className="mt-3"><Link className="btn btn-primary" href={href(locale, `/academy/${academy.slug}/courses`)}>Manage courses</Link></p>
      </Card>

      <Card title="Content" className="mt-8">
        {(resources ?? []).length === 0 ? <p className="text-sm text-ink-soft">No content yet. Uploading and managing your own books comes next.</p> : (
          <ul className="divide-y divide-line text-sm">
            {(resources ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{r.title}</span><span className="text-ink-soft">{r.status} · {r.access_tier}</span></li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
