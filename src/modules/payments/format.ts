/** Integer paisa to a display price: 250000 -> "PKR 2,500". Paisa are shown only when there are some. */
export function formatPkr(paisa: number): string {
  const rupees = Math.floor(paisa / 100);
  const rest = paisa % 100;
  const whole = rupees.toLocaleString("en-US");
  return `PKR ${whole}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}

export const periodLabel = (months: number): string =>
  months === 1 ? "per month" : months === 12 ? "per year" : `for ${months} months`;

export const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for your payment details",
  submitted: "Submitted, waiting for review",
  under_review: "Being reviewed",
  approved: "Approved",
  rejected: "Rejected",
  refunded: "Refunded",
  cancelled: "Cancelled",
  expired: "Expired",
};
export const statusLabel = (s: string): string => STATUS_LABEL[s] ?? s;
