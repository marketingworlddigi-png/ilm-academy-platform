import type { ReactNode } from "react";

type Search = Record<string, string | string[] | undefined>;

/** Reads the ?error= / ?notice= messages set by server actions. */
export function flashFrom(sp: Search) {
  return {
    error: typeof sp.error === "string" ? sp.error : null,
    notice: typeof sp.notice === "string" ? sp.notice : null,
  };
}

export function Flash({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {notice && <p role="status" className="mt-4 rounded-lg border border-line bg-paper-2 p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger/40 p-3 text-sm text-danger">{error}</p>}
    </>
  );
}

export function Field({ label, name, defaultValue, required, rtl, placeholder, type = "text", hint, className }: {
  label: string; name: string; defaultValue?: string | number | null; required?: boolean; rtl?: boolean;
  placeholder?: string; type?: string; hint?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="field" id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required}
        dir={rtl ? "rtl" : undefined} placeholder={placeholder} />
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export function NameFields({ v }: { v?: { name_en?: string | null; name_ur?: string | null; name_ar?: string | null } }) {
  return (
    <>
      <Field label="Name (English)" name="name_en" defaultValue={v?.name_en} required />
      <Field label="Name (Urdu)" name="name_ur" defaultValue={v?.name_ur} rtl />
      <Field label="Name (Arabic)" name="name_ar" defaultValue={v?.name_ar} rtl />
    </>
  );
}

export function StatusSelect({ value = "draft" }: { value?: string }) {
  return (
    <div>
      <label className="label" htmlFor="status">Status</label>
      <select className="field" id="status" name="status" defaultValue={value}>
        <option value="draft">Draft (hidden)</option>
        <option value="published">Published (public)</option>
        <option value="archived">Archived (hidden)</option>
      </select>
    </div>
  );
}

/** Deletion needs an explicit tick, so it works without any client-side JavaScript. */
export function DeleteForm({ action, locale, fields, what }: {
  action: (fd: FormData) => Promise<void>; locale: string; fields: Record<string, string>; what: string;
}) {
  return (
    <form action={action} className="mt-10 rounded-xl border border-danger/40 p-5">
      <h2 className="font-semibold text-danger">Delete this {what}</h2>
      <p className="mt-1 text-sm text-ink-soft">This cannot be undone. If something still uses it, deletion is refused; archive it instead.</p>
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" required /> Yes, delete this {what}</label>
      <button className="btn btn-ghost mt-3 text-danger" type="submit">Delete {what}</button>
    </form>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line p-5 ${className}`}>
      {title && <h2 className="mb-4 font-semibold">{title}</h2>}
      {children}
    </section>
  );
}
