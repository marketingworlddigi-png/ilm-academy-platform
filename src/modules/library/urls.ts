/** Public URL of a cover in the "covers-public" bucket. `version` busts the CDN cache after a replacement. */
export function coverPublicUrl(path: string | null | undefined, version?: string | null): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  const v = version ? `?v=${encodeURIComponent(version)}` : "";
  return `${base}/storage/v1/object/public/covers-public/${path.split("/").map(encodeURIComponent).join("/")}${v}`;
}
