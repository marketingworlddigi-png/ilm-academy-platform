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
