import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache override yet: add R2 cache binding when ISR is needed.
export default defineCloudflareConfig();
