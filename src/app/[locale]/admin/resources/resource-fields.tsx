import { Field } from "@/components/admin/ui";
import { ACCESS_TIERS, RESOURCE_KINDS } from "@/modules/library/schemas";

type Resource = Record<string, string | number | null | undefined>;
const str = (v: string | number | null | undefined) => (typeof v === "string" ? v : null);
type Link = { level_id: string; subjects: { id: string; name_en: string } | { id: string; name_en: string }[] | null };

function Select({ label, name, value, children }: { label: string; name: string; value?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select className="field" id={name} name={name} defaultValue={value ?? ""}>{children}</select>
    </div>
  );
}

/** Shared by the create and edit forms. Placement is validated again on the server (level in board, subject at level). */
export function ResourceFields({ resource: r, boards, levels, links }: {
  resource?: Resource; boards: { id: string; name_en: string }[]; levels: { id: string; board_id: string; name_en: string }[]; links: Link[];
}) {
  const boardName = new Map(boards.map((b) => [b.id, b.name_en]));
  const subjects = new Map<string, string>();
  for (const l of links) for (const s of [l.subjects].flat()) if (s) subjects.set(s.id, s.name_en);
  return (
    <>
      <Field label="Title" name="title" defaultValue={r?.title} required className="sm:col-span-2" />
      <Field label="Title (Urdu)" name="title_ur" defaultValue={r?.title_ur} rtl />
      <Field label="Title (Arabic)" name="title_ar" defaultValue={r?.title_ar} rtl />
      <Field label="Author" name="author" defaultValue={r?.author} />
      <Field label="Publisher" name="publisher" defaultValue={r?.publisher} />
      <Field label="Edition" name="edition" defaultValue={r?.edition} />
      <Field label="Language" name="language" defaultValue={r?.language} placeholder="e.g. Arabic, Urdu" />
      <Field label="Publication year" name="publication_year" type="number" defaultValue={r?.publication_year} hint="Gregorian year" />
      <Field label="Official website link" name="official_source_url" type="url" defaultValue={r?.official_source_url as string | null} className="sm:col-span-2"
        placeholder="https://" hint="Optional. Shown as a Read on official website button when this site has no file to read." />
      <Select label="Type" name="kind" value={str(r?.kind) ?? "book"}>{RESOURCE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</Select>
      <Select label="Access tier" name="access_tier" value={str(r?.access_tier) ?? "free"}>{ACCESS_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
      <Select label="Board" name="board_id" value={r?.board_id as string | null}>
        <option value="">None</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.name_en}</option>)}
      </Select>
      <Select label="Level" name="level_id" value={r?.level_id as string | null}>
        <option value="">None</option>{levels.map((l) => <option key={l.id} value={l.id}>{boardName.get(l.board_id)} / {l.name_en}</option>)}
      </Select>
      <Select label="Subject" name="subject_id" value={r?.subject_id as string | null}>
        <option value="">None</option>{[...subjects].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </Select>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="description">Description</label>
        <textarea className="field" id="description" name="description" rows={4} defaultValue={(r?.description as string) ?? ""} />
      </div>
    </>
  );
}
