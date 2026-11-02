// Shared by the browser upload form and the server action (no zod, keeps the client bundle small).
export const PROOF_BUCKET = "payment-proofs";
export const PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PROOF_MIMES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** Object name `<user_id>/<payment_id>/proof.<ext>`: the storage policy keys off these two folders. */
export function proofObjectName(userId: string, paymentId: string, mime: string): string | null {
  const ext = PROOF_MIMES[mime];
  return ext ? `${userId}/${paymentId}/proof.${ext}` : null;
}

/** Server-side check that a client-reported path is exactly one we would have generated for this payer and payment. */
export const isExpectedProofPath = (userId: string, paymentId: string, path: string): boolean =>
  Object.values(PROOF_MIMES).some((ext) => path === `${userId}/${paymentId}/proof.${ext}`);

export const isImageProof = (path: string | null | undefined): boolean => /\.(jpg|png|webp)$/i.test(path ?? "");
