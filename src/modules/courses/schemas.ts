import { z } from "zod";
import { parseVideoUrl, VIDEO_HELP } from "./video";

// Mirrors the checks in migration 12; the database re-checks everything.
const optText = (max: number, msg: string) => z.string().trim().max(max, msg).optional().transform((v) => v || null);

export const courseSlugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/, "The web address needs 3 to 60 lowercase letters, numbers or hyphens");

export const courseSchema = z.object({
  title: z.string().trim().min(3, "Enter a course title (at least 3 characters)").max(160, "Keep the title under 160 characters"),
  slug: courseSlugSchema,
  summary: optText(300, "Keep the summary under 300 characters"),
  description: optText(5000, "Keep the description under 5000 characters"),
});

export const newCourseSchema = courseSchema.pick({ title: true, slug: true });

export const moduleSchema = z.object({
  title: z.string().trim().min(2, "Enter a module title").max(160, "Keep the title under 160 characters"),
});

export const lessonSchema = z.object({
  title: z.string().trim().min(2, "Enter a lesson title").max(160, "Keep the title under 160 characters"),
  body: optText(20000, "Keep the lesson text under 20000 characters"),
  video_url: z.string().trim().max(500, "Keep the video link under 500 characters").optional()
    .refine((v) => !v || parseVideoUrl(v) !== null, `That video link is not supported. ${VIDEO_HELP}`)
    .transform((v) => v || null),
  is_preview: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  resource_id: z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid("Invalid book").nullable()),
});

export const COURSE_STATUS_LABEL: Record<string, string> = { draft: "Draft (hidden)", published: "Published", archived: "Archived (hidden)" };

export const REVIEW_LABEL: Record<string, string> = {
  none: "Not submitted", submitted: "Waiting for platform review", changes_requested: "Needs changes", approved: "Approved",
};

export const reviewDecisionSchema = z.object({
  decision: z.enum(["approve", "changes"], { message: "Choose approve or needs changes" }),
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional().transform((v) => v || null),
}).refine((v) => v.decision === "approve" || (v.note !== null && v.note.length >= 3), { message: "Tell the academy what to change", path: ["note"] });

/** "Sarf Basics" -> "sarf-basics": a suggestion only. */
export const suggestCourseSlug = (title: string): string =>
  title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");

export function courseErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  switch (error?.code) {
    case "23505": return "That web address is already used by another course in this academy.";
    case "23503": return "Remove what is inside it first.";
    case "22023": case "55000": return error.message ?? "Check the form and try again.";
    case "28000": return "Sign in to continue.";
    case "P0002": return "That course is not available.";
    case "42501": return error.message?.startsWith("You cannot enroll") ? error.message : "You are not allowed to do that.";
    default: return "Something went wrong. Please try again.";
  }
}
