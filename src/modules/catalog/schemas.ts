import { z } from "zod";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and hyphens").max(80);
const name = z.string().trim().min(2, "Enter an English name").max(160);
const optName = z.string().trim().max(160).optional().transform((v) => v || null);
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const sortOrder = z.coerce.number().int().min(0).max(9999).default(0);
const status = z.enum(["draft", "published", "archived"]);

export const idSchema = z.uuid("Invalid id");

export const boardSchema = z.object({
  slug, name_en: name, name_ur: optName, name_ar: optName, description: optText(2000), status, sort_order: sortOrder,
});
export const levelSchema = z.object({
  board_id: idSchema, slug, name_en: name, name_ur: optName, name_ar: optName, sort_order: sortOrder,
});
export const subjectSchema = z.object({
  slug, name_en: name, name_ur: optName, name_ar: optName, status, sort_order: sortOrder,
});

/** Checkbox lists arrive as repeated fields; keep only valid, de-duplicated uuids. */
export function uuidList(values: FormDataEntryValue[]): string[] {
  return [...new Set(values.map(String).filter((v) => idSchema.safeParse(v).success))];
}
