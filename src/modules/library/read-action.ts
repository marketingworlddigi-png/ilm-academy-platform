export type ReadActionInput = {
  accessTier: string;
  /** The copyright holder permits reading in the browser (from public_resource_info). */
  allowOnlineView: boolean;
  /** Result of can_access_resource(id, 'view') for the signed-in user; null when signed out or not yet known. */
  canView: boolean | null;
};

/**
 * What the book page offers next to the details.
 * - "read": show the Read online button.
 * - "premium": reading is allowed by the rights holder but this visitor does not have access (show a badge).
 * - "none": nothing, because online reading is not permitted at all.
 * Free books show the button to everyone (the reader asks for sign-in); other tiers need the database to say yes.
 */
export function readAction({ accessTier, allowOnlineView, canView }: ReadActionInput): "read" | "premium" | "none" {
  if (!allowOnlineView) return "none";
  if (accessTier === "free") return "read";
  return canView === true ? "read" : "premium";
}
