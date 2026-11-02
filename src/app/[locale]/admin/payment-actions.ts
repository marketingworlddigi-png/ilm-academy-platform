"use server";
import { requireSuperAdmin } from "@/lib/auth/session";
import { idSchema } from "@/modules/catalog/schemas";
import { catalogErrorMessage, NOT_FOUND_OR_DENIED } from "@/modules/catalog/errors";
import { paymentErrorMessage } from "@/modules/payments/errors";
import { approveSchema, methodSchema, planSchema, rejectSchema } from "@/modules/payments/schemas";
import { finish, localeOf, raw } from "./action-utils";

// Money decisions live in the database functions (approve_payment, reject_payment): they re-check that the caller is a super
// admin, lock the payment row and write the audit log. These actions only validate input and show readable messages.

const detail = (id: string) => `/admin/payments/${id}`;
const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Check the form and try again.";

export async function claimPaymentReview(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/admin/payments", "error", NOT_FOUND_OR_DENIED);
  const { error } = await supabase.rpc("claim_payment_review", { p_payment: id.data });
  if (error) return finish(l, detail(id.data), "error", paymentErrorMessage(error));
  return finish(l, detail(id.data), "notice", "Marked as under review.");
}

export async function approvePayment(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/admin/payments", "error", NOT_FOUND_OR_DENIED);
  const parsed = approveSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, detail(id.data), "error", firstIssue(parsed.error));
  const { error } = await supabase.rpc("approve_payment", { p_payment: id.data, p_note: parsed.data.note });
  if (error) return finish(l, detail(id.data), "error", paymentErrorMessage(error));
  return finish(l, detail(id.data), "notice", "Payment approved. Premium access is active for the payer.");
}

export async function rejectPayment(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/admin/payments", "error", NOT_FOUND_OR_DENIED);
  const parsed = rejectSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, detail(id.data), "error", firstIssue(parsed.error));
  const { error } = await supabase.rpc("reject_payment", { p_payment: id.data, p_reason: parsed.data.reason });
  if (error) return finish(l, detail(id.data), "error", paymentErrorMessage(error));
  return finish(l, detail(id.data), "notice", "Payment rejected. The payer can see your reason.");
}

export async function savePlan(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/admin/plans", "error", NOT_FOUND_OR_DENIED);
  const parsed = planSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, "/admin/plans", "error", firstIssue(parsed.error));
  const { data, error } = await supabase.from("plans").update(parsed.data).eq("id", id.data).select("id");
  if (error) return finish(l, "/admin/plans", "error", catalogErrorMessage(error, "plan"));
  if (!data?.length) return finish(l, "/admin/plans", "error", NOT_FOUND_OR_DENIED);
  return finish(l, "/admin/plans", "notice", "Plan saved. Existing payments keep the price they were created with.");
}

export async function saveMethod(fd: FormData) {
  const l = localeOf(fd);
  const { supabase } = await requireSuperAdmin(l);
  const code = String(fd.get("code") ?? "");
  if (!["bank_transfer", "jazzcash", "easypaisa"].includes(code)) return finish(l, "/admin/payment-methods", "error", NOT_FOUND_OR_DENIED);
  const parsed = methodSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, "/admin/payment-methods", "error", firstIssue(parsed.error));
  const { data, error } = await supabase.from("payment_methods").update(parsed.data).eq("code", code).select("code");
  if (error) return finish(l, "/admin/payment-methods", "error", catalogErrorMessage(error, "payment method"));
  if (!data?.length) return finish(l, "/admin/payment-methods", "error", NOT_FOUND_OR_DENIED);
  return finish(l, "/admin/payment-methods", "notice", "Payment method saved.");
}
