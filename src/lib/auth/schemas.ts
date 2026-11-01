import { z } from "zod";

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters").max(72),
});
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(72) });

export const forgotSchema = z.object({ email: z.email("Enter a valid email address") });
export const resetSchema = z
  .object({
    password: z.string().min(10, "Use at least 10 characters").max(72, "Use at most 72 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords do not match", path: ["confirm"] });
