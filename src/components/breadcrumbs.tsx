import Link from "next/link";
import { absoluteUrl } from "@/lib/site";
import { JsonLd } from "./json-ld";

export type Crumb = { label: string; path: string };

/** Visible trail plus BreadcrumbList structured data. The last crumb is the current page and is not a link. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-soft">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {crumbs.map((c, i) => (
            <li key={c.path} className="flex items-center gap-2">
              {i < crumbs.length - 1
                ? <Link className="underline" href={c.path}>{c.label}</Link>
                : <span aria-current="page" className="text-ink">{c.label}</span>}
              {i < crumbs.length - 1 && <span aria-hidden="true">/</span>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: absoluteUrl(c.path) })),
      }} />
    </>
  );
}
