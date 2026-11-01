import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters").max(72),
});
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(72) });

export const boardSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and hyphens"),
  name_en: z.string().trim().min(2).max(160),
  name_ur: z.string().trim().max(160).optional().transform((v) => v || null),
  name_ar: z.string().trim().max(160).optional().transform((v) => v || null),
  status: z.enum(["draft", "published"]),
});
