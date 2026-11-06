"use server";
import { redirect } from "next/navigation";
import { href } from "@/lib/i18n/config";
import { requireUser } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { localeOf } from "./admin/action-utils";

// Issues the certificate through claim_certificate(), which re-checks every lesson and quiz on the server.
// The course page address is rebuilt from the database, never taken from the form.
export async function claimCertificate(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const id = idSchema.safeParse(fd.get("course_id"));
  if (!id.success) return redirect(href(l, "/learn"));
  const { data: c } = await supabase.from("courses").select("slug, academies!inner(slug)").eq("id", id.data).maybeSingle();
  const a = c && [c.academies].flat()[0];
  if (!c || !a) return redirect(href(l, "/learn"));
  const back = href(l, `/courses/${a.slug}/${c.slug}`);
  const { data: code, error } = await supabase.rpc("claim_certificate", { p_course: id.data });
  if (error || typeof code !== "string") {
    const msg = ["22023", "42501"].includes(error?.code ?? "") ? error!.message : "We could not issue the certificate. Please try again.";
    return redirect(`${back}?error=${encodeURIComponent(msg)}`);
  }
  return redirect(href(l, `/certificates/${code}`));
}

// Academy owners and admins withdraw a certificate. The database function re-checks who may do this; the page address is
// rebuilt from the academy slug, which is validated against what the user can actually see.
export async function revokeCertificate(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireUser(l);
  const slug = String(fd.get("academy") ?? "");
  const { data: academy } = await supabase.from("academies").select("slug").eq("slug", slug).maybeSingle();
  if (!academy) return redirect(href(l, "/academy"));
  const back = href(l, `/academy/${academy.slug}/certificates`);
  const { error } = await supabase.rpc("revoke_certificate", { p_code: String(fd.get("code") ?? ""), p_reason: String(fd.get("reason") ?? "") });
  if (error) return redirect(`${back}?error=${encodeURIComponent(["22023", "P0002"].includes(error.code) ? error.message : "We could not withdraw the certificate.")}`);
  return redirect(`${back}?notice=${encodeURIComponent("Certificate withdrawn.")}`);
}
