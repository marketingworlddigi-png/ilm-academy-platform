"use client";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type LessonTab = { id: string; label: string; panel: ReactNode };

// Accessible tabs (WAI-ARIA): arrow keys, Home and End move between tabs; only the active panel is shown.
export function LessonTabs({ tabs, initial }: { tabs: LessonTab[]; initial?: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial! : tabs[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  if (tabs.length === 1) return <>{tabs[0].panel}</>;

  const move = (e: KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label="Lesson sections" className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:thin] border-b border-line">
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} role="tab" type="button" id={`tab-${t.id}`} aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`} tabIndex={active === t.id ? 0 : -1} onClick={() => setActive(t.id)} onKeyDown={(e) => move(e, i)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${active === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}>{t.label}</button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} tabIndex={0}>{t.panel}</div>
      ))}
    </div>
  );
}
