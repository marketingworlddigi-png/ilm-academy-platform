import { z } from "zod";
import { idSchema } from "@/modules/catalog/schemas";

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const optId = z.preprocess((v) => (v === "" || v == null ? null : v), idSchema.nullable());
const optYear = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(600, "Year looks wrong").max(2200, "Year looks wrong").nullable());
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

export const RESOURCE_KINDS = ["book", "note", "pdf", "document", "audio", "other"] as const;
export const ACCESS_TIERS = ["free", "premium", "academy"] as const;
export const LICENSE_TYPES = ["original_work", "explicit_permission", "public_domain", "open_license", "commercial_license", "unknown"] as const;
export const PERMISSION_STATUSES = ["not_reviewed", "pending_verification", "permission_requested", "approved", "rejected", "expired", "restricted", "removed"] as const;

/** Only absolute http(s) links; mirrors the check constraint in migration 13. */
export const officialUrl = z.string().trim().max(500, "Keep the link under 500 characters").optional().transform((v) => v || null)
  .refine((v) => v === null || /^https?:\/\/[^\s/]+[^\s]*$/i.test(v), "Enter a full web address starting with https://");

export const resourceSchema = z.object({
  title: z.string().trim().min(2, "Enter a title").max(300),
  title_ur: optText(300), title_ar: optText(300),
  author: optText(200), publisher: optText(200), edition: optText(100), language: optText(40),
  publication_year: optYear,
  description: optText(5000),
  official_source_url: officialUrl,
  kind: z.enum(RESOURCE_KINDS),
  access_tier: z.enum(ACCESS_TIERS),
  board_id: optId, level_id: optId, subject_id: optId,
});

export const copyrightSchema = z.object({
  permission_status: z.enum(PERMISSION_STATUSES),
  license_type: z.enum(LICENSE_TYPES),
  copyright_owner: optText(300),
  original_source: optText(500),
  publication_year: optYear,
  evidence_reference: optText(1000),
  attribution_text: optText(500),
  restrictions: optText(2000),
  expires_on: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid expiry date").nullable()),
  allow_online_view: checkbox, allow_download: checkbox, allow_commercial: checkbox,
}).superRefine((v, ctx) => {
  const bad = (message: string, path: string) => ctx.addIssue({ code: "custom", message, path: [path] });
  const anyGrant = v.allow_online_view || v.allow_download || v.allow_commercial;
  if (v.permission_status !== "approved" && anyGrant) bad("Distribution grants only apply when the status is Approved. Untick them or approve the record.", "permission_status");
  if (v.permission_status === "approved") {
    if (v.license_type === "unknown") bad("An approved record needs a known license type.", "license_type");
    if (!anyGrant) bad("An approved record must grant at least one thing (online view, download or commercial use).", "allow_online_view");
  }
  if (v.allow_download && !v.allow_online_view) bad("Download permission also needs online view permission.", "allow_download");
});

/** End of the chosen day, UTC, so "expires 2027-01-31" stays valid through that whole day. */
export const expiryToTimestamp = (d: string | null) => (d ? `${d}T23:59:59.999Z` : null);
