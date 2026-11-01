import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { LICENSE_TYPES, PERMISSION_STATUSES } from "@/modules/library/schemas";
import { coverPublicUrl } from "@/modules/library/urls";
import { Card, DeleteForm, Field, Flash, flashFrom } from "@/components/admin/ui";
import { FileUpload } from "@/components/admin/file-upload";
import { attachUpload, deleteResource, publishResource, saveCopyright, unpublishResource, updateResource } from "../../resource-actions";
import { ResourceFields } from "../resource-fields";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resource | Admin", robots: { index: false, follow: false } };

const dateOnly = (v: string | null) => (v ? v.slice(0, 10) : "");

export default async function ResourceDetail({ params, searchParams }: PageProps<"/[locale]/admin/resources/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !idSchema.safeParse(id).success) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const { error, notice } = flashFrom(await searchParams);
  const [{ data: r }, { data: perm }, { data: boards }, { data: levels }, { data: links }] = await Promise.all([
    supabase.from("resources").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("copyright_permissions").select("*").eq("resource_id", id).maybeSingle(),
    supabase.from("boards").select("id, name_en").order("sort_order").order("name_en"),
    supabase.from("levels").select("id, board_id, name_en").order("sort_order").order("name_en"),
    supabase.from("level_subjects").select("level_id, subjects(id, name_en)"),
  ]);
  if (!r) notFound();
  const cover = coverPublicUrl(r.cover_path, r.updated_at);
  const approved = perm?.permission_status === "approved";

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/admin/resources")}>All resources</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{r.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">Status: <strong>{r.status}</strong> · Permission: <strong>{perm?.permission_status.replaceAll("_", " ")}</strong></p>
      <Flash error={error} notice={notice} />

      <Card title="Details" className="mt-8">
        <form action={updateResource} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={r.id} />
          <ResourceFields resource={r} boards={boards ?? []} levels={levels ?? []} links={links ?? []} />
          <div className="flex items-end"><button className="btn btn-primary" type="submit">Save details</button></div>
        </form>
      </Card>

      <Card title="Files" className="mt-8">
        <div className="grid gap-6">
          <FileUpload kind="main" resourceId={r.id} locale={locale} label="Main file (PDF or MP3, private)" current={r.storage_path} action={attachUpload} />
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
            <FileUpload kind="cover" resourceId={r.id} locale={locale} label="Cover image (public)" current={r.cover_path} action={attachUpload} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {cover && <img src={cover} alt="Current cover" width={96} height={128} className="h-32 w-24 rounded-lg border border-line object-cover" />}
          </div>
        </div>
      </Card>

      <Card title="Copyright and distribution permission" className="mt-8">
        <p className="mb-4 text-sm text-ink-soft">Only an Approved record with evidence allows publishing. Grants switch off automatically if the status leaves Approved or the expiry passes.</p>
        <form action={saveCopyright} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={r.id} />
          <div>
            <label className="label" htmlFor="permission_status">Permission status</label>
            <select className="field" id="permission_status" name="permission_status" defaultValue={perm?.permission_status}>
              {PERMISSION_STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="license_type">License type</label>
            <select className="field" id="license_type" name="license_type" defaultValue={perm?.license_type}>
              {LICENSE_TYPES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
            </select>
          </div>
          <Field label="Copyright owner" name="copyright_owner" defaultValue={perm?.copyright_owner} />
          <Field label="Original source" name="original_source" defaultValue={perm?.original_source} />
          <Field label="Original publication year" name="publication_year" type="number" defaultValue={perm?.publication_year} />
          <Field label="Permission expires on" name="expires_on" type="date" defaultValue={dateOnly(perm?.expires_at ?? null)} hint="Leave empty if it does not expire." />
          <div className="sm:col-span-2">
            <label className="label" htmlFor="evidence_reference">Evidence reference</label>
            <textarea className="field" id="evidence_reference" name="evidence_reference" rows={3} defaultValue={perm?.evidence_reference ?? ""}
              placeholder="Letter date and sender, licence URL, or why it is public domain" />
          </div>
          <Field label="Attribution text" name="attribution_text" defaultValue={perm?.attribution_text} className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <label className="label" htmlFor="restrictions">Restrictions</label>
            <textarea className="field" id="restrictions" name="restrictions" rows={2} defaultValue={perm?.restrictions ?? ""} />
          </div>
          <fieldset className="sm:col-span-2 flex flex-wrap gap-6 text-sm">
            <legend className="label">Granted rights</legend>
            <label className="flex items-center gap-2"><input type="checkbox" name="allow_online_view" defaultChecked={perm?.allow_online_view} /> Online viewing</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="allow_download" defaultChecked={perm?.allow_download} /> Download</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="allow_commercial" defaultChecked={perm?.allow_commercial} /> Commercial use (premium tiers)</label>
          </fieldset>
          <div className="sm:col-span-2"><button className="btn btn-primary" type="submit">Save copyright record</button></div>
        </form>
        <div className="mt-6 border-t border-line pt-6">
          <FileUpload kind="evidence" resourceId={r.id} locale={locale} label="Evidence file (private: letter, licence, scan)" current={perm?.evidence_file_path} action={attachUpload} />
        </div>
      </Card>

      <Card title="Publishing" className="mt-8">
        {r.status === "published" ? (
          <form action={unpublishResource} className="flex flex-wrap gap-3">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={r.id} />
            <button className="btn btn-ghost" type="submit" name="status" value="draft">Unpublish (back to draft)</button>
            <button className="btn btn-ghost" type="submit" name="status" value="archived">Archive</button>
          </form>
        ) : (
          <form action={publishResource}>
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={r.id} />
            <p className="mb-3 text-sm text-ink-soft">
              Needs: main file {r.storage_path ? "✓" : "missing"}, permission {approved ? "approved" : "not approved yet"}.
            </p>
            <button className="btn btn-primary" type="submit" disabled={!r.storage_path || !approved}>Publish</button>
          </form>
        )}
      </Card>

      <DeleteForm action={deleteResource} locale={locale} fields={{ id: r.id }} what="resource" />
    </main>
  );
}
