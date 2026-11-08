// Large line-art ornaments in gold. Decorative only (aria-hidden), no raster images.
export function GeoStar({ className = "", spin = "spin-slow" }: { className?: string; spin?: "spin-slow" | "spin-slower" | "" }) {
  const sq = (r: number) => <rect x={100 - r} y={100 - r} width={r * 2} height={r * 2} />;
  return (
    <svg aria-hidden="true" viewBox="0 0 200 200" fill="none" stroke="#e3b94d" strokeWidth="0.6" vectorEffect="non-scaling-stroke" className={`${spin} pointer-events-none select-none ${className}`}>
      <g style={{ vectorEffect: "non-scaling-stroke" }}>
        <circle cx="100" cy="100" r="97" strokeOpacity=".5" />
        <circle cx="100" cy="100" r="92" strokeOpacity=".25" />
        <g strokeOpacity=".7">{sq(66)}<g transform="rotate(45 100 100)">{sq(66)}</g></g>
        <g strokeOpacity=".5" transform="rotate(22.5 100 100)">{sq(52)}<g transform="rotate(45 100 100)">{sq(52)}</g></g>
        <circle cx="100" cy="100" r="40" strokeOpacity=".4" />
        <g strokeOpacity=".35"><g transform="rotate(0 100 100)">{sq(28)}</g><g transform="rotate(45 100 100)">{sq(28)}</g></g>
        <circle cx="100" cy="100" r="3" fill="#e3b94d" stroke="none" />
      </g>
    </svg>
  );
}

/** Row of Darse Nizami subjects in Arabic with their transliteration, scrolling slowly. Real subject names, no figures. */
const SUBJECTS: Array<[string, string]> = [
  ["النحو", "Nahw"], ["الصرف", "Sarf"], ["الفقه", "Fiqh"], ["أصول الفقه", "Usul al-Fiqh"], ["الحديث", "Hadith"],
  ["التفسير", "Tafsir"], ["المنطق", "Mantiq"], ["البلاغة", "Balaghah"], ["العقيدة", "Aqidah"], ["الفرائض", "Faraid"],
];
export function SubjectMarquee() {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {SUBJECTS.map(([ar, en]) => (
        <li key={en} className="flex items-center gap-6 pe-6">
          <span lang="ar" dir="rtl" className="arabic-title text-3xl text-white/90">{ar}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-gold/80">{en}</span>
          <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-gold/70" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee overflow-hidden border-t border-gold/25 py-5 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]" role="presentation">
      <div className="marquee-track">{row(false)}{row(true)}</div>
    </div>
  );
}
