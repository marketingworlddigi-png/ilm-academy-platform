// The payment functions raise these codes with messages written for people (see migration 8):
// 42501 not allowed, P0002 not found / unavailable, 22023 invalid input, 55000 wrong state, 23505 duplicate transaction ID.
const OURS = new Set(["42501", "P0002", "22023", "55000", "23505"]);

/** A message safe to show a user or admin. Database internals (policy names, table names) never reach the page. */
export function paymentErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (error?.code && OURS.has(error.code) && error.message && !/permission denied|row-level security|violates/i.test(error.message)) {
    return error.message;
  }
  if (error?.code === "42501") return "You are not allowed to do that.";
  if (error?.code === "23505") return "That transaction ID has already been submitted.";
  return "Something went wrong. Please try again.";
}
