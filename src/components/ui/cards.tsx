import Link from "next/link";
import { Badge, ProgressBar } from "./primitives";
import { GeoStar } from "../ornaments";

/** One darja (level) tile: number badge, Urdu name in Nastaliq, transliterated name and a subtitle. */
export function DarjaCard({ href, number, tag, nameUr, nameLatin, subtitle }: {
  href: string; number: number; tag?: string | null; nameUr?: string | null; nameLatin: string; subtitle: string;
}) {
  return (
    <li>
      <Link href={href} className="flex h-full flex-col rounded-[6px] border border-line bg-sheet p-4 transition-[transform,border-color,box-shadow] duration-200 hover:border-gold-deep hover:shadow-[0_14px_30px_-18px_rgba(14,33,82,0.45)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className="flex items-center justify-between">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary-dark text-sm font-bold text-white">{number}</span>
          {tag && <Badge>{tag}</Badge>}
        </span>
        {nameUr && <span lang="ur" dir="rtl" className="urdu mt-3 text-xl font-bold text-ink">{nameUr}</span>}
        <span className={`${nameUr ? "" : "mt-3 "}block font-semibold text-ink`}>{nameLatin}</span>
        <span className="mt-auto pt-2 text-sm text-muted">{subtitle}</span>
      </Link>
    </li>
  );
}

/** Course tile: a green band carrying the Arabic title, then eyebrow, title, academy and teacher, and lesson count. */
export function CourseCard({ href, arabicTitle, premium, eyebrow, title, byline, meta, progress }: {
  href: string; arabicTitle?: string | null; premium: boolean; eyebrow?: string; title: string; byline?: string; meta?: string; progress?: number;
}) {
  return (
    <li>
      <Link href={href} className="flex h-full flex-col overflow-hidden rounded-[6px] border border-line bg-sheet transition-[transform,border-color,box-shadow] duration-200 hover:border-gold-deep hover:shadow-[0_14px_30px_-18px_rgba(14,33,82,0.45)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className="khatam relative flex h-24 items-center justify-center overflow-hidden px-4">
          <GeoStar spin="spin-slow" className="absolute -end-6 -top-10 h-36 w-36 opacity-60" />
          {arabicTitle && <span lang="ar" dir="rtl" className="arabic-title relative truncate text-2xl font-bold text-gold">{arabicTitle}</span>}
          <Badge tone={premium ? "gold" : "green"} className="absolute end-3 top-3">{premium ? "Premium" : "Free"}</Badge>
        </span>
        <span className="flex flex-1 flex-col p-4">
          {eyebrow && <span className="text-xs font-bold uppercase tracking-wide text-primary">{eyebrow}</span>}
          <span className="mt-1 font-semibold leading-snug text-ink">{title}</span>
          {byline && <span className="mt-1 text-sm text-muted">{byline}</span>}
          {progress !== undefined && <ProgressBar value={progress} className="mt-3" label={`${title} progress`} />}
          {meta && <span className="mt-auto pt-3 text-sm text-muted">{meta}</span>}
        </span>
      </Link>
    </li>
  );
}

/** Subject tile: Arabic or Urdu name in its own script on top, English name and book count below. */
export function SubjectCard({ href, nameNative, nativeLang, nameLatin, subtitle }: {
  href: string; nameNative?: string | null; nativeLang?: "ur" | "ar"; nameLatin: string; subtitle: string;
}) {
  return (
    <li>
      <Link href={href} className="flex h-full flex-col rounded-[6px] border border-line bg-sheet p-4 transition-[transform,border-color,box-shadow] duration-200 hover:border-gold-deep hover:shadow-[0_14px_30px_-18px_rgba(14,33,82,0.45)] motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {nameNative && <span lang={nativeLang} dir="rtl" className={`${nativeLang === "ar" ? "arabic-title" : "urdu"} text-xl font-bold text-primary`}>{nameNative}</span>}
        <span className={`${nameNative ? "" : "mt-1 "}block font-semibold text-ink`}>{nameLatin}</span>
        <span className="mt-auto pt-2 text-sm text-muted">{subtitle}</span>
      </Link>
    </li>
  );
}
