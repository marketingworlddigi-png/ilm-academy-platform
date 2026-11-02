import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/** Cookie-less anonymous client for public pages: no session, so pages can be cached. RLS shows only published data. */
export function createPublicClient() {
  const env = getServerEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
