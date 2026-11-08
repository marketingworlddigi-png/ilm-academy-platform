import Link from "next/link";

export type ContentsItem = { id: string; href: string; latin: string; note: string; ur?: string | null };

/** Darajat laid out like the fihrist of a printed kitab: numeral, name, dotted leader, Urdu name. */
export function DarjaContents({ items }: { items: ContentsItem[] }) {
  return (
    <ol className="grid gap-x-16 md:grid-cols-2">
      {items.map((it, i) => (
        <li key={it.id} className="border-b border-line/80">
          <Link href={it.href} className="group relative flex items-end gap-3 py-5 transition-[padding] duration-200 hover:ps-3 focus-visible:outline-2 focus-visible:outline-primary">
            <span aria-hidden="true" className="absolute inset-y-3 start-0 w-0.5 origin-center scale-y-0 bg-gold transition-transform duration-200 group-hover:scale-y-100" />
            <span aria-hidden="true" className="font-display w-10 shrink-0 text-4xl leading-none text-vermilion">{i + 1}</span>
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-lg font-semibold leading-tight text-ink">{it.latin}</span>
              <span className="block text-xs text-muted">{it.note}</span>
            </span>
            <span aria-hidden="true" className="leader" />
            {it.ur && <span lang="ur" dir="rtl" className="urdu shrink-0 whitespace-nowrap text-2xl font-bold text-primary-dark">{it.ur}</span>}
          </Link>
        </li>
      ))}
    </ol>
  );
}
