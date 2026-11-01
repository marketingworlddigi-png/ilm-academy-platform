// Fails if the gzip size of the Worker upload exceeds the Cloudflare plan limit.
// Run after `npm run cf:build`. Limit defaults to 3 MiB (Workers Free); override with WORKER_LIMIT_KIB.
import { execSync } from "node:child_process";
const limit = Number(process.env.WORKER_LIMIT_KIB ?? 3072);
const out = execSync("npx wrangler deploy --dry-run --outdir .wrangler-dry", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const m = out.match(/gzip:\s*([\d.]+)\s*KiB/);
if (!m) { console.error("Could not read bundle size from wrangler output."); process.exit(2); }
const kib = Number(m[1]);
console.log(`Worker gzip size: ${kib} KiB (limit ${limit} KiB)`);
if (kib > limit) { console.error("Bundle exceeds limit."); process.exit(1); }
