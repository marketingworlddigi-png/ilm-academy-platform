import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

type Variant = "primary" | "outline" | "dark" | "gold" | "ghost";
const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  outline: "border border-line bg-white text-ink hover:border-muted",
  dark: "bg-primary-dark text-white hover:bg-ink",
  gold: "bg-gold text-ink hover:brightness-95",
  ghost: "text-primary hover:bg-surface",
};
const SIZE = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-[0.95rem]", lg: "px-6 py-3 text-base" } as const;

type ButtonProps = { variant?: Variant; size?: keyof typeof SIZE; className?: string; children: ReactNode } & (
  | ({ href: string } & { type?: never })
  | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
);

/** One button for links and form buttons. Pass href for a link, otherwise it is a <button>. */
export function Button({ variant = "primary", size = "md", className, children, ...rest }: ButtonProps) {
  const cls = cx("inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55", VARIANT[variant], SIZE[size], className);
  if ("href" in rest && rest.href !== undefined) return <Link href={rest.href} className={cls}>{children}</Link>;
  const { href: _h, ...btn } = rest as ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
  void _h;
  return <button {...btn} className={cls}>{children}</button>;
}

/** White panel with a 1px line border. No shadow, no gradient. */
export function Card({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" | "aside" }) {
  return <Tag className={cx("rounded-[14px] border border-line bg-white", className)}>{children}</Tag>;
}

type Tone = "neutral" | "green" | "gold" | "dark" | "danger";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface text-muted border border-line",
  green: "bg-[#e3f1ea] text-primary-dark",
  gold: "bg-gold text-ink",
  dark: "bg-primary-dark text-white",
  danger: "bg-[#fbe9e9] text-danger",
};
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[tone], className)}>{children}</span>;
}

/** value is 0..100; it is clamped, so a bad number cannot overflow the track. */
export function ProgressBar({ value, label, tone = "green", className }: { value: number; label?: string; tone?: "green" | "gold"; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label ?? "Progress"}
      className={cx("h-2 w-full overflow-hidden rounded-full", tone === "gold" ? "bg-white/20" : "bg-line", className)}>
      <div className={cx("h-full rounded-full", tone === "gold" ? "bg-gold" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-line bg-white px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, eyebrow, children, actions }: { title: string; eyebrow?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-bold leading-tight text-ink sm:text-4xl">{title}</h1>
        {children && <p className="mt-2 max-w-2xl text-muted">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
