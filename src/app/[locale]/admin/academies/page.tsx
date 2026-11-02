import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { ACADEMY_STATUS_LABEL } from "@/modules/academies/schemas";
import { Card, Flash, flashFrom } from "@/components/admin/ui";
import { reviewAcademy } from "../academy-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Academies | Admin", robots: { index: false, follow: false } };

const FILTERS: Record<string, { label: string; statuses: string[] | null }> = {
  review: { label: "Needs review", statuses: ["pending", "needs_info"] },
  active: { label: "Active", statuses: ["active"] },
  closed: { label: "Rejected or suspended", statuses: ["rejected", "suspended"] },
  all: { label: "All", statuses: null },
};

export default async function AcademiesAdmin({ params, searchParams }: PageProps<"/[locale]/admin/academies">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const sp = await searchParams;
  const { error, notice } = flashFrom(sp);
  const key = typeof sp.show === "string" && sp.show in FILTERS ? sp.show : "review";

  let query = supabase.from("academies").select("id, slug, name, description, status, status_note, owner_id, created_at").is("deleted_at", null).order("created_at", { ascending: true }).limit(100);
  const statuses = FILTERS[key].statuses;
  if (statuses) query = query.in("status", statuses);
  const { data: academies } = await query;
  const ownerIds = [...new Set((academies ?? []).map((a) => a.owner_id))];
  const { data: owners } = ownerIds.length ? await supabase.from("profiles").select("id, full_name").in("id", ownerIds) : { data: [] };
  const ownerName = new Map((owners ?? []).map((o) => [o.id, o.full_name]));

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="font-display text-3xl font-semibold">Academies</h1>
      <p className="mt-1 text-sm text-ink-soft">Oldest first. Anything other than approval needs a note, and the academy sees it. Every decision is audited.</p>
      <Flash error={error} notice={notice} />
      <ul className="mt-6 flex flex-wrap gap-2 text-sm">
        {Object.entries(FILTERS).map(([k, f]) => (
          <li key={k}><Link href={`${href(locale, "/admin/academies")}?show=${k}`}
            className={`rounded-full border px-3 py-1 ${k === key ? "border-brand font-semibold text-brand" : "border-line text-ink-soft"}`}>{f.label}</Link></li>
        ))}
      </ul>
      {(academies ?? []).length === 0 && <p className="mt-6 text-ink-soft">Nothing here.</p>}
      {(academies ?? []).map((a) => (
        <Card key={a.id} title={`${a.name} (/${a.slug})`} className="mt-6">
          <p className="text-sm text-ink-soft">
            {ACADEMY_STATUS_LABEL[a.status] ?? a.status} · owner {ownerName.get(a.owner_id) ?? "unnamed"} · registered {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {a.description && <p className="mt-2 text-sm">{a.description}</p>}
          {a.status_note && <p className="mt-2 text-sm text-ink-soft"><strong>Current note:</strong> {a.status_note}</p>}
          <form action={reviewAcademy} className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={a.id} />
            <div><label className="label" htmlFor={`st-${a.id}`}>Outcome</label>
              <select className="field" id={`st-${a.id}`} name="status" defaultValue={a.status === "active" ? "suspended" : "active"}>
                <option value="active">Approve (active)</option><option value="needs_info">Needs more information</option>
                <option value="rejected">Reject</option><option value="suspended">Suspend</option>
              </select></div>
            <div><label className="label" htmlFor={`nt-${a.id}`}>Note (required unless approving)</label><input className="field" id={`nt-${a.id}`} name="note" maxLength={500} /></div>
            <button className="btn btn-primary" type="submit">Apply</button>
          </form>
        </Card>
      ))}
    </main>
  );
}
