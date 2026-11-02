import Link from "next/link";
import { href, type Locale } from "@/lib/i18n/config";
import { coverPublicUrl } from "@/modules/library/urls";

type Book = { id: string; title: string; title_ur: string | null; title_ar: string | null; author: string | null; cover_path: string | null; updated_at: string; access_tier: string };

export function BookCard({ book, locale }: { book: Book; locale: Locale }) {
  const title = (locale === "ur-pk" ? book.title_ur : locale === "ar" ? book.title_ar : null) || book.title;
  const cover = coverPublicUrl(book.cover_path, book.updated_at);
  return (
    <li className="rounded-xl border border-line p-4">
      <Link href={href(locale, `/books/${book.id}`)} className="flex gap-4">
        {cover
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={cover} alt="" width={72} height={96} loading="lazy" className="h-24 w-[72px] shrink-0 rounded-md border border-line object-cover" />
          : <span aria-hidden="true" className="flex h-24 w-[72px] shrink-0 items-center justify-center rounded-md border border-line bg-paper-2 font-display text-2xl text-ink-soft">{title.slice(0, 1)}</span>}
        <span>
          <span className="block font-semibold text-brand">{title}</span>
          {book.author && <span className="mt-1 block text-sm text-ink-soft">{book.author}</span>}
          <span className="mt-2 block text-xs uppercase tracking-wide text-ink-soft">{book.access_tier === "free" ? "Free" : book.access_tier}</span>
        </span>
      </Link>
    </li>
  );
}
