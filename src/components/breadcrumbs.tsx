import Link from "next/link";
import { absoluteUrl } from "@/lib/site";
import { JsonLd } from "./json-ld";

export type Crumb = { label: string; path: string };

/** Visible trail plus BreadcrumbList structured data. The last crumb is the current page and is not a link. */
export function Breadcrumbs({ crumbs, tone = "light" }: { crumbs: Crumb[]; tone?: "light" | "dark" }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className={`text-sm ${tone === "dark" ? "text-white/70" : "text-muted"}`}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {crumbs.map((c, i) => (
            <li key={c.path} className="flex items-center gap-2">
              {i < crumbs.length - 1
                ? <Link className="underline" href={c.path}>{c.label}</Link>
                : <span aria-current="page" className={tone === "dark" ? "font-semibold text-white" : "text-ink"}>{c.label}</span>}
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
