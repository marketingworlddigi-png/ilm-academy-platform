import { z } from "zod";

// Mirrors register_academy() in migration 10; the database re-checks everything.
export const RESERVED_SLUGS = ["admin", "api", "auth", "academy", "academies", "account", "library", "books", "pricing", "checkout", "login", "signup", "ilm", "ilm-academy", "support", "help", "www"];

export const registerAcademySchema = z.object({
  name: z.string().trim().min(2, "Enter the academy name").max(120, "Keep the name under 120 characters"),
  slug: z.string().trim().toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "The web address needs 3 to 40 lowercase letters, numbers or hyphens")
    .refine((s) => !RESERVED_SLUGS.includes(s), "That web address is reserved"),
});

export const academyProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter the academy name").max(120, "Keep the name under 120 characters"),
  description: z.string().trim().max(2000, "Keep the description under 2000 characters").optional().transform((v) => v || null),
});

export const ACADEMY_REVIEW_STATUSES = ["active", "needs_info", "rejected", "suspended"] as const;
export const reviewAcademySchema = z.object({
  status: z.enum(ACADEMY_REVIEW_STATUSES, { error: "Choose an outcome" }),
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional().transform((v) => v || null),
}).refine((v) => v.status === "active" || (v.note && v.note.length >= 3), { message: "Give a short note so the academy knows why", path: ["note"] });

/** "Noor Academy" -> "noor-academy": a suggestion only; the person can edit it. */
export const suggestSlug = (name: string): string =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");

export const ACADEMY_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for review",
  needs_info: "More information needed",
  active: "Active",
  rejected: "Not approved",
  suspended: "Suspended",
};

export function academyErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  switch (error?.code) {
    case "23505": return "That web address is already taken. Try another.";
    case "22023": case "53400": return error.message ?? "Check the form and try again.";
    case "42501": return "You are not allowed to do that.";
    case "P0002": return "That academy no longer exists.";
    default: return "Something went wrong. Please try again.";
  }
}
