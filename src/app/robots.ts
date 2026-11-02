import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { DISALLOWED_PATHS } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
