import { describe, expect, it } from "vitest";
import { formatPkr, periodLabel, statusLabel } from "@/modules/payments/format";
import { isExpectedProofPath, isImageProof, proofObjectName } from "@/modules/payments/proofs";
import { paymentErrorMessage } from "@/modules/payments/errors";
import { checkoutSchema, methodSchema, planSchema, rejectSchema, submitSchema } from "@/modules/payments/schemas";

describe("formatPkr", () => {
  it("formats whole rupees with grouping", () => {
    expect(formatPkr(100000)).toBe("PKR 1,000");
    expect(formatPkr(1000000)).toBe("PKR 10,000");
  });
  it("shows paisa only when present", () => {
    expect(formatPkr(249950)).toBe("PKR 2,499.50");
    expect(formatPkr(5)).toBe("PKR 0.05");
  });
});

describe("labels", () => {
  it("describes billing periods", () => {
    expect(periodLabel(1)).toBe("per month");
    expect(periodLabel(12)).toBe("per year");
    expect(periodLabel(3)).toBe("for 3 months");
  });
  it("falls back to the raw status", () => {
    expect(statusLabel("approved")).toBe("Approved");
    expect(statusLabel("weird")).toBe("weird");
  });
});

describe("proof paths", () => {
  const u = "11111111-1111-4111-8111-111111111111";
  const p = "22222222-2222-4222-8222-222222222222";
  it("builds object names only for allowed types", () => {
    expect(proofObjectName(u, p, "image/png")).toBe(`${u}/${p}/proof.png`);
    expect(proofObjectName(u, p, "application/pdf")).toBe(`${u}/${p}/proof.pdf`);
    expect(proofObjectName(u, p, "text/html")).toBeNull();
  });
  it("accepts only the exact path generated for this payer and payment", () => {
    expect(isExpectedProofPath(u, p, `${u}/${p}/proof.jpg`)).toBe(true);
    expect(isExpectedProofPath(u, p, `${p}/${p}/proof.jpg`)).toBe(false);
    expect(isExpectedProofPath(u, p, `${u}/${u}/proof.jpg`)).toBe(false);
    expect(isExpectedProofPath(u, p, `${u}/${p}/../proof.jpg`)).toBe(false);
    expect(isExpectedProofPath(u, p, `${u}/${p}/proof.exe`)).toBe(false);
  });
  it("tells images from PDFs", () => {
    expect(isImageProof("a/b/proof.png")).toBe(true);
    expect(isImageProof("a/b/proof.pdf")).toBe(false);
    expect(isImageProof(null)).toBe(false);
  });
});

describe("paymentErrorMessage", () => {
  it("passes through our own messages", () => {
    expect(paymentErrorMessage({ code: "23505", message: "This transaction ID was already used." })).toBe("This transaction ID was already used.");
    expect(paymentErrorMessage({ code: "55000", message: "Payment is not awaiting review." })).toBe("Payment is not awaiting review.");
  });
  it("hides database internals", () => {
    expect(paymentErrorMessage({ code: "42501", message: 'new row violates row-level security policy for table "payments"' })).toBe("You are not allowed to do that.");
    expect(paymentErrorMessage({ code: "XX000", message: "relation payments does not exist" })).toBe("Something went wrong. Please try again.");
    expect(paymentErrorMessage(null)).toBe("Something went wrong. Please try again.");
  });
});

describe("payment schemas", () => {
  it("checkout needs a plan id and a known method", () => {
    expect(checkoutSchema.safeParse({ plan_id: "22222222-2222-4222-8222-222222222222", method: "jazzcash" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ plan_id: "x", method: "jazzcash" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ plan_id: "22222222-2222-4222-8222-222222222222", method: "paypal" }).success).toBe(false);
  });
  it("checkout carries no price: the amount is never taken from the client", () => {
    const r = checkoutSchema.safeParse({ plan_id: "22222222-2222-4222-8222-222222222222", method: "easypaisa", amount: 1 });
    expect(r.success && "amount" in r.data).toBe(false);
  });
  it("submit requires a real-looking transaction ID", () => {
    expect(submitSchema.safeParse({ reference: "12345" }).success).toBe(false);
    const ok = submitSchema.safeParse({ reference: "  TXN123456  " });
    expect(ok.success && ok.data.reference).toBe("TXN123456");
    expect(ok.success && ok.data.note).toBeNull();
  });
  it("reject requires a reason", () => {
    expect(rejectSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(rejectSchema.safeParse({ reason: "Amount does not match" }).success).toBe(true);
  });
  it("plan converts rupees to paisa without float drift", () => {
    const r = planSchema.parse({ name: "Premium", price: "2499.50", sort_order: "1" });
    expect(r.price_paisa).toBe(249950);
    expect(planSchema.parse({ name: "Premium", price: "19.99" }).price_paisa).toBe(1999);
    expect(planSchema.safeParse({ name: "Premium", price: "0" }).success).toBe(false);
    expect(planSchema.parse({ name: "Premium", price: "10", is_active: "on" }).is_active).toBe(true);
    expect(planSchema.parse({ name: "Premium", price: "10" }).is_active).toBe(false);
  });
  it("a method cannot be switched on without account details and instructions", () => {
    expect(methodSchema.safeParse({ is_active: "on" }).success).toBe(false);
    expect(methodSchema.safeParse({ is_active: "on", account_number: "0300", instructions: "Send to this wallet" }).success).toBe(true);
    expect(methodSchema.safeParse({}).success).toBe(true);
  });
});
