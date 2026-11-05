"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HeaderAuth } from "./header-auth";

type Item = { href: string; label: string };
type Lang = { href: string; code: string; label: string; current: boolean };

// Phone menu (below 768px): a button that opens a full-width panel. Esc closes, Tab stays inside the panel, focus returns to the button.
export function MobileMenu({ locale, nav, langs, accountHref, loginHref, signupHref }: {
  locale: string; nav: Item[]; langs: Lang[]; accountHref: string; loginHref: string; signupHref: string;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); button.current?.focus(); return; }
      if (e.key !== "Tab") return;
      const items = [button.current, ...focusables()].filter(Boolean) as HTMLElement[];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button ref={button} type="button" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 rounded-[10px] border border-line px-3 text-sm font-semibold text-primary-dark">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        Menu
      </button>
      {open && (
        <div ref={panel} id="mobile-menu" role="dialog" aria-label="Menu" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
          className="absolute inset-x-0 top-full z-40 border-b border-line bg-white px-5 pb-6 pt-2 shadow-lg">
          <nav aria-label="Primary" className="flex flex-col">
            {nav.map((n) => <Link key={n.href} href={n.href} className="border-b border-line py-3.5 text-lg font-semibold text-ink">{n.label}</Link>)}
          </nav>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Language">
            {langs.map((l) => (
              <li key={l.code}>
                <Link href={l.href} hrefLang={l.code} lang={l.code} aria-current={l.current ? "true" : undefined}
                  className={`block rounded-full border px-4 py-2 text-sm ${l.current ? "border-primary bg-primary font-bold text-white" : "border-line text-muted"}`}>{l.label}</Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-2 [&_.btn]:w-full [&_form]:w-full" onClick={() => setOpen(false)}>
            <HeaderAuth locale={locale} accountHref={accountHref} loginHref={loginHref} signupHref={signupHref} />
          </div>
        </div>
      )}
    </div>
  );
}
