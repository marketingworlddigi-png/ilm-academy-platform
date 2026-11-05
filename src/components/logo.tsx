// The Ilm Academy mark: a mihrab arch holding an open book, with the Urdu name beside the English one.
// Flat shapes in the brand green and gold only. Pass tone="light" on dark backgrounds.
export function LogoMark({ size = 36, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  const arch = tone === "light" ? "#ffffff" : "#0a3d2e";
  const book = tone === "light" ? "#0a3d2e" : "#e9c46a";
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* arch */}
      <path d="M5 37V19C5 10.2 11.7 3 20 3s15 7.2 15 16v18z" fill={arch} />
      {/* open book */}
      <path d="M20 17.5c-2.6-1.7-6-2.2-9-1.6v11.6c3-.6 6.4-.1 9 1.6 2.6-1.7 6-2.2 9-1.6V15.9c-3-.6-6.4-.1-9 1.6z" fill={book} />
      <path d="M20 17.5v11.6" stroke={arch} strokeWidth="1.4" />
    </svg>
  );
}

export function Logo({ tone = "dark", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  const text = tone === "light" ? "text-white" : "text-primary-dark";
  const sub = tone === "light" ? "text-gold" : "text-primary";
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark tone={tone} />
      <span className="flex flex-col leading-none">
        <span className={`text-xl font-extrabold tracking-tight ${text}`}>Ilm Academy</span>
        {!compact && <span lang="ur" dir="rtl" className={`urdu mt-0.5 self-start text-[13px] font-semibold ${sub}`} style={{ lineHeight: 1.5 }}>علم اکیڈمی</span>}
      </span>
    </span>
  );
}
