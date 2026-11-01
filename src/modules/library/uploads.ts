// Pure helpers shared by the browser upload component and the server actions (no zod, keeps the client bundle small).
export type UploadKind = "main" | "cover" | "evidence";
export const UPLOAD_RULES: Record<UploadKind, { bucket: string; base: string; maxBytes: number; mimes: Record<string, string> }> = {
  main: { bucket: "resources-private", base: "file", maxBytes: 50 * 1024 * 1024, mimes: { "application/pdf": "pdf", "audio/mpeg": "mp3" } },
  cover: { bucket: "covers-public", base: "cover", maxBytes: 2 * 1024 * 1024, mimes: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } },
  evidence: { bucket: "copyright-evidence", base: "evidence", maxBytes: 10 * 1024 * 1024, mimes: { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" } },
};

/** Object name for an upload: fixed per resource and kind, so a re-upload replaces the old file (no orphans). */
export function objectNameFor(kind: UploadKind, resourceId: string, mime: string): string | null {
  const ext = UPLOAD_RULES[kind].mimes[mime];
  return ext ? `${resourceId}/${UPLOAD_RULES[kind].base}.${ext}` : null;
}

/** Server-side check that a client-reported path is exactly one we would have generated for this resource. */
export function isExpectedObjectName(kind: UploadKind, resourceId: string, path: string): boolean {
  const r = UPLOAD_RULES[kind];
  return Object.values(r.mimes).some((ext) => path === `${resourceId}/${r.base}.${ext}`);
}
