"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { boardSchema } from "@/lib/auth/schemas";
import { defaultLocale, href, isLocale } from "@/lib/i18n/config";

export async function createBoard(fd: FormData) {
  const raw = String(fd.get("locale") ?? "");
  const locale = isLocale(raw) ? raw : defaultLocale;
  const page = href(locale, "/admin/boards");
  const parsed = boardSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) redirect(`${page}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  // User-scoped client: RLS decides. A non-admin gets a permission error even if they call this action directly.
  const supabase = await createClient();
  const { error } = await supabase.from("boards").insert(parsed.data!);
  if (error) {
    const msg = error.code === "23505" ? "A board with that slug already exists." : "Could not save the board (are you signed in as an administrator?).";
    redirect(`${page}?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath(page);
  redirect(`${page}?notice=${encodeURIComponent("Board saved.")}`);
}
