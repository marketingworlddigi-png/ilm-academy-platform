import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the config minimal so the app stays portable (Cloudflare Workers today, VPS later).
  poweredByHeader: false,
  images: { unoptimized: true }, // Workers has no sharp; use Cloudflare Images/R2 transforms later.
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
