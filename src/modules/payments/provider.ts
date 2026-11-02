import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentRequest = { planId: string; methodCode: string };
export type StartedPayment = { paymentId: string; redirectUrl?: string };

/**
 * How a payment is started and settled. Today only the manual provider exists: the payer transfers money, submits the
 * transaction ID and proof, and an admin approves (approve_payment in the database grants the entitlement).
 * A gateway provider would implement the same interface, return a `redirectUrl` to the hosted checkout, and settle through
 * a signed webhook that calls the same approval path. Card data is never stored here.
 */
export interface PaymentProvider {
  readonly id: string;
  readonly kind: "manual" | "gateway";
  startPayment(req: PaymentRequest): Promise<StartedPayment>;
}

export class PaymentError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

/** Manual bank transfer / JazzCash / Easypaisa. The price is chosen by the database (create_payment), never by the caller. */
export class ManualPaymentProvider implements PaymentProvider {
  readonly id = "manual";
  readonly kind = "manual" as const;
  constructor(private readonly db: SupabaseClient) {}

  async startPayment({ planId, methodCode }: PaymentRequest): Promise<StartedPayment> {
    const { data, error } = await this.db.rpc("create_payment", { p_plan: planId, p_method: methodCode });
    if (error || typeof data !== "string") throw new PaymentError(error?.message ?? "Could not start the payment", error?.code);
    return { paymentId: data };
  }
}
