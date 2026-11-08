import type { CSSProperties, ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

const delay = (i: number) => ({ "--i": i }) as CSSProperties;

/** The shared dark header of every inner page: breadcrumbs, gold eyebrow, serif title, native-script line and a short blurb. */
export function PageHero({ crumbs, eyebrow, title, native, nativeLang = "ur", blurb, children }: {
  crumbs: Crumb[]; eyebrow: string; title: ReactNode; native?: string | null; nativeLang?: "ur" | "ar"; blurb?: ReactNode; children?: ReactNode;
}) {
  return (
    <section className="khatam page-hero text-white">
      <div className="mx-auto max-w-6xl px-5">
        <Breadcrumbs tone="dark" crumbs={crumbs} />
        <p className="rise mt-8 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.3em] text-gold">
          <span aria-hidden="true" className="grow-x h-px w-14 bg-gold" />{eyebrow}
        </p>
        {native && (
          <p lang={nativeLang} dir="rtl" className={`${nativeLang === "ar" ? "arabic-title" : "urdu"} rise mt-4 w-fit font-bold text-gold`} style={delay(1)}>{native}</p>
        )}
        <h1 className={`rise ${native ? "mt-2" : "mt-4"} max-w-3xl`} style={delay(2)}>{title}</h1>
        {blurb && <div className="rise mt-4 max-w-2xl text-lg leading-relaxed text-white/75" style={delay(3)}>{blurb}</div>}
        {children && <div className="rise mt-6" style={delay(4)}>{children}</div>}
      </div>
    </section>
  );
}

/** Section label used above big serif headings on light backgrounds. */
export function SectionHead({ eyebrow, title, lead, align = "start" }: { eyebrow: string; title: ReactNode; lead?: ReactNode; align?: "start" | "center" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-deep">{eyebrow}</p>
      <h2 className="mt-2 text-4xl leading-tight sm:text-5xl">{title}</h2>
      <div className={`ornament mt-6 ${align === "center" ? "mx-auto" : ""}`}><span /></div>
      {lead && <p className="mt-5 text-lg leading-relaxed text-muted">{lead}</p>}
    </div>
  );
}
