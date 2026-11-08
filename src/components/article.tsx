import type { GuideSection } from "@/content/guides";

/** Long-form body: sticky contents list beside the text on large screens, serif headings, ornamental callouts. */
export function Article({ intro, sections }: { intro?: string; sections: GuideSection[] }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[15rem_1fr]">
      <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">On this page</p>
        <ol className="mt-4 space-y-1 border-s border-line text-sm">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="-ms-px flex gap-3 border-s border-transparent py-1.5 ps-4 text-muted transition-colors hover:border-gold-deep hover:text-ink">
                <span aria-hidden="true" className="font-display text-vermilion">{i + 1}</span>{s.h}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="prose-ilm min-w-0">
        {intro && <p className="dropcap text-xl leading-[1.8] text-ink/85">{intro}</p>}
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-28">
            <h2>{s.h}</h2>
            {s.p?.map((t, i) => <p key={i}>{t}</p>)}
            {s.list && (s.ordered ? <ol>{s.list.map((t) => <li key={t}>{t}</li>)}</ol> : <ul>{s.list.map((t) => <li key={t}>{t}</li>)}</ul>)}
            {s.callout && (
              <aside className="callout">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{s.callout.title}</p>
                <p className="font-display mt-2 text-2xl leading-snug text-primary-dark">{s.callout.text}</p>
              </aside>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
