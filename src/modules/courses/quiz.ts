import { z } from "zod";

// Mirrors the checks in migration 17; the database re-checks everything.
export const quizSettingsSchema = z.object({
  title: z.string().trim().min(2, "Enter a quiz title").max(160, "Keep the title under 160 characters"),
  pass_percent: z.coerce.number({ message: "Pass mark must be a number" }).int("Pass mark must be a whole number").min(1, "Pass mark is 1 to 100").max(100, "Pass mark is 1 to 100"),
});

/** The form sends up to six option fields (option_1..option_6) and "correct" (1..6). Empty option fields are ignored. */
export const questionSchema = z.object({
  prompt: z.string().trim().min(2, "Enter the question").max(500, "Keep the question under 500 characters"),
  explanation: z.string().trim().max(500, "Keep the explanation under 500 characters").optional().transform((v) => v || null),
  options: z.array(z.string().trim().max(200, "Keep each answer under 200 characters")).transform((a) => a.map((s, i) => ({ label: s, index: i + 1 })).filter((o) => o.label !== "")),
  correct: z.coerce.number().int().min(1).max(6),
}).refine((v) => v.options.length >= 2, { message: "Give at least two answers", path: ["options"] })
  .refine((v) => v.options.some((o) => o.index === v.correct), { message: "Choose which answer is correct (and fill it in)", path: ["correct"] });

export function questionFromForm(fd: FormData) {
  return questionSchema.safeParse({
    prompt: fd.get("prompt") ?? "",
    explanation: fd.get("explanation") ?? "",
    options: [1, 2, 3, 4, 5, 6].map((i) => String(fd.get(`option_${i}`) ?? "")),
    correct: fd.get("correct") ?? "",
  });
}

export function quizErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  switch (error?.code) {
    case "23505": return "This lesson already has a quiz.";
    case "22023": case "55000": case "54000": return error.message ?? "Check the form and try again.";
    case "42501": return "You are not allowed to do that.";
    case "28000": return "Sign in to continue.";
    default: return "Something went wrong. Please try again.";
  }
}
