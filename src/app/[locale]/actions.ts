"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { href, isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";
import { loginSchema, signupSchema } from "@/lib/auth/schemas";

const loc = (fd: FormData): Locale => {
  const v = String(fd.get("locale") ?? "");
  return isLocale(v) ? v : defaultLocale;
};
const back = (l: Locale, page: string, error: string): never =>
  redirect(`${href(l, page)}?error=${encodeURIComponent(error)}`);

export async function login(fd: FormData) {
  const l = loc(fd);
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) back(l, "/login", "Enter your email and password.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data!);
  if (error) back(l, "/login", error.message.includes("not confirmed") ? "Please confirm your email first." : "Incorrect email or password.");
  redirect(href(l, "/account"));
}

export async function signup(fd: FormData) {
  const l = loc(fd);
  const parsed = signupSchema.safeParse({ fullName: fd.get("fullName"), email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) back(l, "/signup", parsed.error.issues[0].message);
  const { fullName, email, password } = parsed.data!;
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(href(l, "/account"))}` },
  });
  if (error) back(l, "/signup", error.message);
  redirect(`${href(l, "/login")}?notice=${encodeURIComponent("Check your email to confirm your account, then sign in.")}`);
}

export async function updateName(fd: FormData) {
  const l = loc(fd);
  const name = String(fd.get("fullName") ?? "").trim();
  if (name.length < 2 || name.length > 120) back(l, "/account", "Enter your name (2 to 120 characters).");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(href(l, "/login"));
  // RLS (profiles_update_own) restricts this to the caller's own row.
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  if (error) back(l, "/account", "Could not save your name.");
  redirect(href(l, "/account"));
}

export async function signOut(fd: FormData) {
  const l = loc(fd);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(href(l));
}
