import Link from "next/link";
import { href, type Locale } from "@/lib/i18n/config";
import { coverPublicUrl } from "@/modules/library/urls";
import { Badge } from "@/components/ui";

type Book = { id: string; title: string; title_ur: string | null; title_ar: string | null; author: string | null; cover_path: string | null; updated_at: string; access_tier: string };

export function BookCard({ book, locale }: { book: Book; locale: Locale }) {
  const title = (locale === "ur-pk" ? book.title_ur : locale === "ar" ? book.title_ar : null) || book.title;
  // The book's own-script title (Arabic first, then Urdu) is shown above the English one when it differs.
  const native = book.title_ar && book.title_ar !== title ? { text: book.title_ar, lang: "ar" as const } : book.title_ur && book.title_ur !== title ? { text: book.title_ur, lang: "ur" as const } : null;
  const cover = coverPublicUrl(book.cover_path, book.updated_at);
  return (
    <li className="tile rounded-[10px] border border-line bg-sheet p-5">
      <Link href={href(locale, `/books/${book.id}`)} className="flex gap-4">
        {cover
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={cover} alt="" width={72} height={96} loading="lazy" className="h-24 w-[72px] shrink-0 rounded-[10px] border border-line object-cover" />
          : <span aria-hidden="true" className="flex h-24 w-[72px] shrink-0 items-center justify-center rounded-[10px] bg-primary text-2xl font-bold text-gold">{title.slice(0, 1)}</span>}
        <span className="min-w-0">
          {native && <span lang={native.lang} dir="rtl" className={`${native.lang === "ar" ? "arabic-title" : "urdu"} tile-gold block text-2xl font-bold text-primary`}>{native.text}</span>}
          <span className="tile-ink font-display block text-xl leading-snug text-ink">{title}</span>
          {book.author && <span className="tile-muted mt-1 block text-sm text-muted">{book.author}</span>}
          <span className="mt-2 block"><Badge tone={book.access_tier === "free" ? "green" : "gold"}>{book.access_tier === "free" ? "Free" : book.access_tier === "academy" ? "Academy" : "Premium"}</Badge></span>
        </span>
      </Link>
    </li>
  );
}
