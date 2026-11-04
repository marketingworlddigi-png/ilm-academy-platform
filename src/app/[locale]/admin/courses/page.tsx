import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { REVIEW_LABEL } from "@/modules/courses/schemas";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { reviewCourse } from "../course-review-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Course review | Admin", robots: { index: false, follow: false } };

const FILTERS: Record<string, { label: string; statuses: string[] }> = {
  queue: { label: "Waiting for review", statuses: ["submitted"] },
  changes: { label: "Sent back", statuses: ["changes_requested"] },
  approved: { label: "Approved", statuses: ["approved"] },
};

export default async function CourseReviewQueue({ params, searchParams }: PageProps<"/[locale]/admin/courses">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const sp = await searchParams;
  const { error, notice } = flashFrom(sp);
  const key = typeof sp.show === "string" && sp.show in FILTERS ? sp.show : "queue";

  const { data: courses } = await supabase.from("courses")
    .select("id, slug, title, summary, review_status, review_note, submitted_at, reviewed_at, academies!inner(slug, name)")
    .in("review_status", FILTERS[key].statuses).is("deleted_at", null)
    .order(key === "queue" ? "submitted_at" : "reviewed_at", { ascending: key === "queue" }).limit(100);
  const ids = (courses ?? []).map((c) => c.id);
  const { data: lessons } = ids.length ? await supabase.from("lessons").select("id, course_id, title, is_preview, video_url").in("course_id", ids).order("position") : { data: [] };
  const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold">Course review</h1>
      <p className="mt-1 text-sm text-ink-soft">Oldest first. A course goes live only when you approve it. Sending it back needs a note, and the academy sees it. Every decision is audited.</p>
      <Flash error={error} notice={notice} />
      <ul className="mt-6 flex flex-wrap gap-2 text-sm">
        {Object.entries(FILTERS).map(([k, f]) => (
          <li key={k}><Link href={`${href(locale, "/admin/courses")}?show=${k}`}
            className={`rounded-full border px-3 py-1 ${k === key ? "border-brand font-semibold text-brand" : "border-line text-ink-soft"}`}>{f.label}</Link></li>
        ))}
      </ul>
      {(courses ?? []).length === 0 && <p className="mt-6 text-ink-soft">Nothing here.</p>}
      {(courses ?? []).map((c) => {
        const a = [c.academies].flat()[0];
        const ls = (lessons ?? []).filter((l) => l.course_id === c.id);
        return (
          <Card key={c.id} title={c.title} className="mt-6">
            <p className="text-sm text-ink-soft">{a?.name} · {REVIEW_LABEL[c.review_status] ?? c.review_status} · submitted {date(c.submitted_at)}</p>
            {c.summary && <p className="mt-2 text-sm">{c.summary}</p>}
            <p className="mt-2 text-sm text-ink-soft">{ls.length} {ls.length === 1 ? "lesson" : "lessons"}, {ls.filter((l) => l.video_url).length} with video</p>
            <ul className="mt-2 list-disc pl-5 text-sm">{ls.map((l) => <li key={l.id}>{l.title}{l.is_preview ? " (free preview)" : ""}</li>)}</ul>
            {c.review_note && <p className="mt-2 text-sm text-ink-soft"><strong>Last note:</strong> {c.review_note}</p>}
            {c.review_status === "submitted" && (
              <form action={reviewCourse} className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
                <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={c.id} />
                <div><label className="label" htmlFor={`d-${c.id}`}>Outcome</label>
                  <select className="field" id={`d-${c.id}`} name="decision" defaultValue="approve">
                    <option value="approve">Approve and publish</option><option value="changes">Needs changes</option>
                  </select></div>
                <div><label className="label" htmlFor={`n-${c.id}`}>Note (required unless approving)</label><input className="field" id={`n-${c.id}`} name="note" maxLength={500} /></div>
                <button className="btn btn-primary" type="submit">Apply</button>
              </form>
            )}
          </Card>
        );
      })}
    </main>
  );
}
