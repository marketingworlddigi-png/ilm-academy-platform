import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SECRET_KEY: z.string().min(10).optional(),
  EXPECTED_SUPABASE_PROJECT_REF: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function getServerEnv(): ServerEnv {
  const env = serverSchema.parse(process.env);
  const ref = env.EXPECTED_SUPABASE_PROJECT_REF;
  // Guard against pointing the app at the wrong (unrelated) Supabase project.
  if (ref && !new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.startsWith(`${ref}.`)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL does not match EXPECTED_SUPABASE_PROJECT_REF.");
  }
  return env;
}
