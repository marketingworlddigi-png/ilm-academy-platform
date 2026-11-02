import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { getSessionUser } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";

export const dynamic = "force-dynamic";
// Members-only content: never indexed. The lesson text itself is returned by the database only to enrolled users (or for previews).
export const metadata: Metadata = { title: "Lesson", robots: { index: false, follow: false } };

export default async function LessonPage({ params }: PageProps<"/[locale]/courses/[academy]/[course]/lessons/[lesson]">) {
  const { locale, academy, course, lesson } = await params;
  if (!isLocale(locale)) notFound();
  const id = idSchema.safeParse(lesson);
  if (!id.success) notFound();

  const { supabase, user } = await getSessionUser();
  const { data: l } = await supabase.from("lessons")
    .select("id, title, body, is_preview, resource_id, position, module_id, courses!inner(id, slug, title, academies!inner(slug))")
    .eq("id", id.data).maybeSingle();
  const c = l && [l.courses].flat()[0];
  const a = c && [c.academies].flat()[0];
  if (!l || !c || !a || c.slug !== course || a.slug !== academy) notFound();

  const here = href(locale, `/courses/${academy}/${course}/lessons/${l.id}`);
  const { data: outline } = await supabase.rpc("course_outline", { p_course: c.id });
  const ordered = (outline ?? []) as { lesson_id: string; title: string }[];
  const idx = ordered.findIndex((o) => o.lesson_id === l.id);
  const next = idx >= 0 ? ordered[idx + 1] : undefined;
  const { data: book } = l.resource_id ? await supabase.from("resources").select("id, title").eq("id", l.resource_id).maybeSingle() : { data: null };

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm"><Link className="text-ink-soft underline" href={href(locale, `/courses/${academy}/${course}`)}>{c.title}</Link></p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{l.title}</h1>
      {l.is_preview && <p className="mt-1 text-xs text-ink-soft">Free preview</p>}
      {/* Plain text only, never HTML. */}
      {l.body ? <div className="mt-6 whitespace-pre-line leading-relaxed">{l.body}</div> : <p className="mt-6 text-ink-soft">This lesson has no text.</p>}
      {book && (
        <p className="mt-8 rounded-xl border border-line p-4 text-sm">
          Reading for this lesson: <Link className="font-semibold text-brand underline" href={href(locale, `/books/${book.id}`)}>{book.title}</Link>
        </p>
      )}
      {!user && (
        <p className="mt-8 text-sm text-ink-soft"><Link className="font-semibold text-brand underline" href={`${href(locale, "/login")}?next=${encodeURIComponent(here)}`}>Sign in</Link> and enroll to open every lesson.</p>
      )}
      {next && (
        <p className="mt-10"><Link className="btn btn-primary" href={href(locale, `/courses/${academy}/${course}/lessons/${next.lesson_id}`)}>Next: {next.title}</Link></p>
      )}
    </main>
  );
}
