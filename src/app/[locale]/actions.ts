"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { href, isLocale, defaultLocale, type Locale } from "@/lib/i18n/config";
import { postLoginPath } from "@/lib/auth/return-path";
import { forgotSchema, loginSchema, resetSchema, signupSchema } from "@/lib/auth/schemas";

const loc = (fd: FormData): Locale => {
  const v = String(fd.get("locale") ?? "");
  return isLocale(v) ? v : defaultLocale;
};
const back = (l: Locale, page: string, error: string, next?: string): never =>
  redirect(`${href(l, page)}?error=${encodeURIComponent(error)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);

export async function login(fd: FormData) {
  const l = loc(fd);
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  const next = fd.get("next") ? postLoginPath(l, fd.get("next")) : undefined;
  if (!parsed.success) back(l, "/login", "Enter your email and password.", next);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data!);
  if (error) back(l, "/login", error.message.includes("not confirmed") ? "Please confirm your email first." : "Incorrect email or password.", next);
  redirect(postLoginPath(l, next));
}

export async function signup(fd: FormData) {
  const l = loc(fd);
  const next = fd.get("next") ? postLoginPath(l, fd.get("next")) : undefined;
  const parsed = signupSchema.safeParse({ fullName: fd.get("fullName"), email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) back(l, "/signup", parsed.error.issues[0].message, next);
  const { fullName, email, password } = parsed.data!;
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(postLoginPath(l, next))}` },
  });
  if (error) back(l, "/signup", error.message, next);
  redirect(`${href(l, "/login")}?notice=${encodeURIComponent("Check your email to confirm your account, then sign in.")}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
}

export async function requestReset(fd: FormData) {
  const l = loc(fd);
  const parsed = forgotSchema.safeParse({ email: fd.get("email") });
  if (!parsed.success) back(l, "/forgot-password", parsed.error.issues[0].message);
  const supabase = await createClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // The result is deliberately ignored: the answer must not reveal whether an account exists.
  await supabase.auth.resetPasswordForEmail(parsed.data!.email, {
    redirectTo: `${site}/auth/callback?next=${encodeURIComponent(href(l, "/reset-password"))}`,
  });
  redirect(`${href(l, "/forgot-password")}?notice=${encodeURIComponent("If an account exists for that address, we have sent a reset link. It expires in one hour.")}`);
}

export async function setNewPassword(fd: FormData) {
  const l = loc(fd);
  const parsed = resetSchema.safeParse({ password: fd.get("password"), confirm: fd.get("confirm") });
  if (!parsed.success) back(l, "/reset-password", parsed.error.issues[0].message);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) back(l, "/forgot-password", "That reset link is invalid or has expired. Request a new one.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data!.password });
  if (error) back(l, "/reset-password", /different|same/i.test(error.message) ? "Choose a password you have not used before." : "Could not update the password. Request a new reset link.");
  await supabase.auth.signOut({ scope: "global" }); // end every session, including any an attacker may hold
  redirect(`${href(l, "/login")}?notice=${encodeURIComponent("Password updated. Sign in with your new password.")}`);
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
