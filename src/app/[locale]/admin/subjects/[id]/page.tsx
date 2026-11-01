import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { requireSuperAdmin } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { Card, DeleteForm, Field, Flash, flashFrom, NameFields, StatusSelect } from "@/components/admin/ui";
import { deleteSubject, updateSubject } from "../../catalog-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subject | Admin", robots: { index: false, follow: false } };

export default async function SubjectDetail({ params, searchParams }: PageProps<"/[locale]/admin/subjects/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !idSchema.safeParse(id).success) notFound();
  const { supabase } = await requireSuperAdmin(locale);
  const { error, notice } = flashFrom(await searchParams);
  const { data: subject } = await supabase.from("subjects").select("*").eq("id", id).maybeSingle();
  if (!subject) notFound();

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, "/admin/subjects")}>All subjects</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{subject.name_en}</h1>
      <Flash error={error} notice={notice} />
      <Card title="Subject details" className="mt-8">
        <form action={updateSubject} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={subject.id} />
          <NameFields v={subject} />
          <Field label="Slug" name="slug" defaultValue={subject.slug} required hint="Changing the slug changes public URLs." />
          <StatusSelect value={subject.status} />
          <Field label="Sort order" name="sort_order" type="number" defaultValue={subject.sort_order} />
          <div className="flex items-end"><button className="btn btn-primary" type="submit">Save changes</button></div>
        </form>
      </Card>
      <DeleteForm action={deleteSubject} locale={locale} fields={{ id: subject.id }} what="subject" />
    </main>
  );
}
