"use server";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { loginUrl } from "@/lib/auth/return-path";
import { href } from "@/lib/i18n/config";
import { idSchema } from "@/modules/catalog/schemas";
import { paymentErrorMessage } from "@/modules/payments/errors";
import { ManualPaymentProvider, PaymentError } from "@/modules/payments/provider";
import { isExpectedProofPath } from "@/modules/payments/proofs";
import { checkoutSchema, submitSchema } from "@/modules/payments/schemas";
import { finish, localeOf, raw } from "./admin/action-utils";

const PLAN_CODE = /^[a-z0-9-]{2,40}$/;

/** Step 1: choose a plan and method. Creates a pending payment priced by the database, then shows the payment instructions. */
export async function startCheckout(fd: FormData) {
  const l = localeOf(fd);
  const planCode = String(fd.get("plan_code") ?? "");
  const back = `/checkout/${PLAN_CODE.test(planCode) ? planCode : ""}`;
  const { supabase, user } = await getSessionUser();
  if (!user) redirect(loginUrl(l, href(l, back)));
  const parsed = checkoutSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, back, "error", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  try {
    const { paymentId } = await new ManualPaymentProvider(supabase).startPayment({ planId: parsed.data.plan_id, methodCode: parsed.data.method });
    return redirect(href(l, `/account/payments/${paymentId}`));
  } catch (e) {
    if (e instanceof PaymentError) return finish(l, back, "error", paymentErrorMessage({ code: e.code, message: e.message }));
    throw e; // redirect() signals via a thrown value; anything else is a real bug
  }
}

/** Step 2: the browser has uploaded the proof straight to Storage; record the transaction ID and submit for review. */
export async function submitPaymentProof(fd: FormData) {
  const l = localeOf(fd);
  const { supabase, user } = await getSessionUser();
  if (!user) redirect(loginUrl(l, href(l, "/account/payments")));
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return finish(l, "/account/payments", "error", "Payment not found.");
  const detail = `/account/payments/${id.data}`;
  const parsed = submitSchema.safeParse(raw(fd));
  if (!parsed.success) return finish(l, detail, "error", parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const path = String(fd.get("path") ?? "");
  if (!isExpectedProofPath(user.id, id.data, path)) return finish(l, detail, "error", "Upload a screenshot or receipt of your payment.");
  const { error } = await supabase.rpc("submit_payment", {
    p_payment: id.data, p_reference: parsed.data.reference, p_proof_path: path, p_note: parsed.data.note,
  });
  if (error) return finish(l, detail, "error", paymentErrorMessage(error));
  return finish(l, detail, "notice", "Thank you. Your payment has been submitted and will be reviewed.");
}
