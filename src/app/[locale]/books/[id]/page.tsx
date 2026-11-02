import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { href, isLocale } from "@/lib/i18n/config";
import { absoluteUrl } from "@/lib/site";
import { idSchema } from "@/modules/catalog/schemas";
import { createPublicClient } from "@/lib/supabase/public";
import { getBook, nameFor } from "@/modules/library/queries";
import { coverPublicUrl } from "@/modules/library/urls";
import { Breadcrumbs, type Crumb } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";

export const revalidate = 300;

const LICENSE_LABEL: Record<string, string> = {
  original_work: "Original work", explicit_permission: "Used with the copyright holder's permission", public_domain: "Public domain",
  open_license: "Open licence", commercial_license: "Commercially licensed", unknown: "Licence on file",
};

const load = (id: string) => (idSchema.safeParse(id).success ? getBook(createPublicClient(), id) : Promise.resolve(null));
const titleOf = (b: { title: string; title_ur: string | null; title_ar: string | null }, locale: string) =>
  (locale === "ur-pk" ? b.title_ur : locale === "ar" ? b.title_ar : null) || b.title;

export async function generateMetadata({ params }: PageProps<"/[locale]/books/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  if (!isLocale(locale)) return {};
  const book = await load(id);
  if (!book) return { title: "Not found", robots: { index: false } };
  const title = titleOf(book, locale);
  const description = (book.description ?? `${title}${book.author ? ` by ${book.author}` : ""}. Details, edition and licence information.`).slice(0, 160);
  const cover = coverPublicUrl(book.cover_path, book.updated_at);
  const path = href(locale, `/books/${book.id}`);
  return {
    title: book.author ? `${title} by ${book.author}` : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "book", title, description, url: absoluteUrl(path), ...(cover ? { images: [{ url: cover }] } : {}) },
  };
}

export default async function BookPage({ params }: PageProps<"/[locale]/books/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const book = await load(id);
  if (!book) notFound();
  const title = titleOf(book, locale);
  const cover = coverPublicUrl(book.cover_path, book.updated_at);
  const crumbs: Crumb[] = [{ label: "Home", path: href(locale) }, { label: "Library", path: href(locale, "/library") }];
  if (book.board) {
    const bp = `/library/${book.board.slug}`;
    crumbs.push({ label: nameFor(book.board, locale), path: href(locale, bp) });
    if (book.level) {
      const lp = `${bp}/${book.level.slug}`;
      crumbs.push({ label: nameFor(book.level, locale), path: href(locale, lp) });
      if (book.subject) crumbs.push({ label: nameFor(book.subject, locale), path: href(locale, `${lp}/${book.subject.slug}`) });
    }
  }
  crumbs.push({ label: title, path: href(locale, `/books/${book.id}`) });

  const facts: [string, string | number | null][] = [
    ["Author", book.author], ["Publisher", book.publisher], ["Edition", book.edition],
    ["Language", book.language], ["Year", book.publication_year], ["Type", book.kind],
  ];

  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <Breadcrumbs crumbs={crumbs} />
      <div className="mt-6 grid gap-8 md:grid-cols-[220px_1fr]">
        <div>
          {cover
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={cover} alt={`Cover of ${title}`} width={220} height={300} className="w-full max-w-[220px] rounded-lg border border-line object-cover" />
            : <div aria-hidden="true" className="flex aspect-[3/4] w-full max-w-[220px] items-center justify-center rounded-lg border border-line bg-paper-2 font-display text-5xl text-ink-soft">{title.slice(0, 1)}</div>}
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
          {book.author && <p className="mt-2 text-lg text-ink-soft">{book.author}</p>}
          {book.description && <p className="mt-6 whitespace-pre-line">{book.description}</p>}
          <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {facts.filter(([, v]) => v).map(([k, v]) => (<div key={k} className="contents"><dt className="text-ink-soft">{k}</dt><dd>{v}</dd></div>))}
            <dt className="text-ink-soft">Access</dt><dd>{book.access_tier === "free" ? "Free" : book.access_tier}</dd>
          </dl>
          {book.info && (
            <section className="mt-8 rounded-xl border border-line p-4 text-sm">
              <h2 className="font-semibold">Licence</h2>
              <p className="mt-1 text-ink-soft">{LICENSE_LABEL[book.info.license_type] ?? "Licence on file"}.{book.info.attribution_text ? ` ${book.info.attribution_text}` : ""}</p>
              <p className="mt-1 text-ink-soft">
                {book.info.allow_online_view ? "Online reading is permitted." : "Online reading is not permitted."}{" "}
                {book.info.allow_download ? "Downloading is permitted." : "Downloading is not permitted."}
              </p>
            </section>
          )}
        </div>
      </div>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Book", name: title, url: absoluteUrl(href(locale, `/books/${book.id}`)),
        ...(book.author ? { author: { "@type": "Person", name: book.author } } : {}),
        ...(book.publisher ? { publisher: { "@type": "Organization", name: book.publisher } } : {}),
        ...(book.language ? { inLanguage: book.language } : {}),
        ...(book.publication_year ? { datePublished: String(book.publication_year) } : {}),
        ...(book.edition ? { bookEdition: book.edition } : {}),
        ...(book.description ? { description: book.description } : {}),
        ...(cover ? { image: cover } : {}),
        isAccessibleForFree: book.access_tier === "free",
      }} />
    </main>
  );
}
