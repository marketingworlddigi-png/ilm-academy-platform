import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = { id: string; code: string; name: string; description: string | null; duration_months: number; price_paisa: number; sort_order: number };
export type Method = { code: string; label: string; account_title: string | null; account_number: string | null; instructions: string | null };

/** Active plans in display order. Works with the anonymous client (plans_read allows active plans for everyone). */
export async function listActivePlans(db: SupabaseClient): Promise<Plan[]> {
  const { data } = await db.from("plans")
    .select("id, code, name, description, duration_months, price_paisa, sort_order")
    .eq("is_active", true).order("sort_order").order("duration_months");
  return (data ?? []) as Plan[];
}

export async function listActiveMethods(db: SupabaseClient): Promise<Method[]> {
  const { data } = await db.from("payment_methods")
    .select("code, label, account_title, account_number, instructions").eq("is_active", true).order("sort_order");
  return (data ?? []) as Method[];
}
