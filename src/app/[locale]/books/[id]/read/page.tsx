import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { idSchema } from "@/modules/catalog/schemas";
import { loginUrl, signupUrl } from "@/lib/auth/return-path";
import { getSessionUser } from "@/lib/auth/session";
import { getProtectedFileUrl } from "@/modules/library/file-access";
import { PdfReader } from "@/components/pdf-reader-lazy";

// Per-user and short-lived: never cached, never indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Read", robots: { index: false, follow: false } };

export default async function ReadPage({ params }: PageProps<"/[locale]/books/[id]/read">) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !idSchema.safeParse(id).success) notFound();
  const { supabase, user } = await getSessionUser();
  const back = href(locale, `/books/${id}`);

  const { data: book } = await supabase.from("resources").select("title, storage_path").eq("id", id).eq("status", "published").maybeSingle();
  if (!book) notFound();

  if (!user) {
    return (
      <Notice title={book.title} back={back}>
        <p>Sign in to read this book online. A free account is enough for free books.</p>
        <p className="mt-4 flex gap-3">
          <Link className="btn btn-primary" href={loginUrl(locale, href(locale, `/books/${id}/read`))}>Sign in</Link>
          <Link className="btn btn-ghost" href={signupUrl(locale, href(locale, `/books/${id}/read`))}>Create account</Link>
        </p>
      </Notice>
    );
  }
  if (!book.storage_path?.toLowerCase().endsWith(".pdf")) {
    return <Notice title={book.title} back={back}><p>This resource cannot be read in the browser.</p></Notice>;
  }
  const file = await getProtectedFileUrl(supabase, id, "view");
  if (!file.ok) {
    return (
      <Notice title={book.title} back={back}>
        <p>{file.reason === "denied"
          ? "You do not have access to read this book online. It may need a premium plan, or online reading may not be permitted by the copyright holder."
          : "The file is not available right now. Please try again later."}</p>
      </Notice>
    );
  }
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm"><Link className="text-ink-soft underline" href={back}>Back to book details</Link></p>
      <h1 className="mb-6 mt-2 font-display text-2xl font-semibold">{book.title}</h1>
      <PdfReader url={file.url} />
    </main>
  );
}

function Notice({ title, back, children }: { title: string; back: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <p className="text-sm"><Link className="text-ink-soft underline" href={back}>Back to book details</Link></p>
      <h1 className="mb-4 mt-2 font-display text-2xl font-semibold">{title}</h1>
      <div className="rounded-xl border border-line p-6 text-ink-soft">{children}</div>
    </main>
  );
}
