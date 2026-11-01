/** Turns a Postgres/PostgREST error into a message safe to show an administrator. */
export function catalogErrorMessage(error: { code?: string } | null | undefined, what: string): string {
  switch (error?.code) {
    case "23505": return `A ${what} with that slug already exists.`;
    case "23001": // ON DELETE RESTRICT
    case "23503": // foreign key / NO ACTION
      return `This ${what} is still in use (levels, subjects or resources refer to it). Remove those first, or set it to archived instead.`;
    case "42501": return "You do not have permission to do that.";
    default: return `Could not save the ${what}. Please try again.`;
  }
}

/** RLS filters rows silently: an update/delete that matched nothing means "not found or not allowed". */
export const NOT_FOUND_OR_DENIED = "Nothing changed: the item no longer exists or you are not allowed to change it.";
