import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { href, type Locale } from "@/lib/i18n/config";

export async function getSessionUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(); // validates the JWT with Supabase Auth, not just the cookie
  return { supabase, user: data.user };
}

export async function requireUser(locale: Locale) {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect(href(locale, "/login"));
  return { supabase, user };
}

/** Server-side gate. The database (RLS) still enforces every write independently. */
export async function requireSuperAdmin(locale: Locale) {
  const { supabase, user } = await requireUser(locale);
  const { data } = await supabase.rpc("is_super_admin");
  if (data !== true) redirect(href(locale, "/account"));
  return { supabase, user };
}
