import type { ReactNode } from "react";
import { GeoStar } from "./ornaments";
import { Button } from "./ui";

/** Closing call to action used at the foot of the content pages. */
export function CtaBand({ eyebrow, title, text, primary, secondary }: {
  eyebrow: string; title: ReactNode; text: string; primary: { label: string; href: string }; secondary?: { label: string; href: string };
}) {
  return (
    <section className="khatam relative overflow-hidden text-white">
      <GeoStar className="absolute -start-24 top-1/2 h-[28rem] w-[28rem] -translate-y-1/2 opacity-40" />
      <div className="relative mx-auto max-w-4xl px-5 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">{eyebrow}</p>
        <h2 className="mt-4 text-4xl leading-tight sm:text-6xl">{title}</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">{text}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href={primary.href} variant="gold" size="lg">{primary.label}</Button>
          {secondary && <Button href={secondary.href} variant="outline" size="lg" className="!border-white/30 !bg-transparent !text-white hover:!border-gold hover:!text-gold">{secondary.label}</Button>}
        </div>
      </div>
    </section>
  );
}
