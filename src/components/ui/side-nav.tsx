import Link from "next/link";
import type { ReactNode } from "react";

export type SideNavItem = { href: string; label: string; current?: boolean };

/**
 * Dark-green navigation for the student and academy dashboards. On small screens it collapses to a horizontally
 * scrolling strip above the content, so there is no hidden menu to open. `footer` holds the plan box or public URL.
 */
export function SideNav({ title, subtitle, items, footer, label }: {
  title: string; subtitle?: string; items: SideNavItem[]; footer?: ReactNode; label: string;
}) {
  return (
    <aside className="bg-primary-dark text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
      <div className="px-5 pt-5 lg:pb-4">
        <p className="font-bold">{title}</p>
        {subtitle && <p className="text-sm text-white/70">{subtitle}</p>}
      </div>
      <nav aria-label={label} className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-visible">
        {items.map((it) => (
          <Link key={it.href} href={it.href} aria-current={it.current ? "page" : undefined}
            className={`whitespace-nowrap rounded-[10px] px-3 py-2 text-sm font-medium ${it.current ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
            {it.label}
          </Link>
        ))}
      </nav>
      {footer && <div className="hidden border-t border-white/10 p-4 text-sm lg:block">{footer}</div>}
    </aside>
  );
}
