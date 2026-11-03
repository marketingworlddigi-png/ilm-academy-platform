import { z } from "zod";

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

export const checkoutSchema = z.object({
  plan_id: z.uuid("Choose a plan"),
  method: z.enum(["bank_transfer", "jazzcash", "easypaisa"], { error: "Choose how you will pay" }),
});

export const submitSchema = z.object({
  reference: z.string().trim().min(6, "Enter the transaction ID exactly as shown on your receipt").max(64, "That transaction ID is too long"),
  note: optText(500),
});

export const OWN_CODE_MESSAGE = "This is your payment code. Enter the transaction ID from your JazzCash/Easypaisa SMS or bank receipt.";

/** The payment code is ours, shown to the payer to quote in the transfer; it is not proof of payment. Case-insensitive. */
export const isOwnPaymentCode = (reference: string, paymentCode: string): boolean =>
  reference.trim().toLowerCase() === paymentCode.trim().toLowerCase();

export const rejectSchema = z.object({ reason: z.string().trim().min(3, "Give a short reason so the payer knows what to fix").max(500, "Keep the reason under 500 characters") });
export const approveSchema = z.object({ note: optText(500) });

/** Admins type prices in rupees; the database stores integer paisa. */
export const planSchema = z.object({
  name: z.string().trim().min(2, "Enter a plan name").max(80),
  description: optText(500),
  price: z.coerce.number("Enter a price").min(1, "The price must be at least PKR 1").max(10_000_000, "That price is too high"),
  is_active: checkbox,
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
}).transform(({ price, ...rest }) => ({ ...rest, price_paisa: Math.round(price * 100) }));

export const methodSchema = z.object({
  account_title: optText(120),
  account_number: optText(80),
  instructions: optText(1500),
  is_active: checkbox,
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
}).refine((v) => !v.is_active || (v.account_number && v.instructions), {
  message: "To switch a method on, fill in the account number and the instructions payers will see.",
});
