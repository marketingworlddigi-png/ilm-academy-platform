/** Absolute origin for canonical URLs, sitemap and structured data. Set NEXT_PUBLIC_SITE_URL in production. */
export const siteUrl = (): string => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
export const absoluteUrl = (path: string): string => `${siteUrl()}${path}`;
