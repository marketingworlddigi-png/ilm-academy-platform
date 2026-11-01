const FALLBACK = "/en-pk/account";
const BASE = "http://site.invalid";

/**
 * Returns `next` only if it is a same-site relative path, otherwise the fallback.
 * Rejects protocol-relative ("//x"), backslash ("/\x", which browsers treat as "//x"),
 * control characters (browsers strip tab/CR/LF, so "/\t/x" becomes "//x") and anything that
 * does not resolve back to our own origin. Encoded forms are checked after decoding too.
 */
export function safeNextPath(next: string | null | undefined, fallback = FALLBACK): string {
  if (!next || !next.startsWith("/")) return fallback;
  let decoded = next;
  try { decoded = decodeURIComponent(next); } catch { return fallback; }
  for (const s of [next, decoded]) {
    if (s.startsWith("//") || s.includes("\\") || /[\u0000-\u001f\u007f]/.test(s)) return fallback;
  }
  try {
    if (new URL(next, BASE).origin !== BASE) return fallback;
  } catch { return fallback; }
  return next;
}
