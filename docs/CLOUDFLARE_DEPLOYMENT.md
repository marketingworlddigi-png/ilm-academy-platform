# Cloudflare Deployment

Verified on 2026-11-01 with Next.js 16.4.3 and @opennextjs/cloudflare 1.20.15.

## What works
- `npm run cf:build` produces `.open-next/worker.js`; `npm run check:bundle` fails if the gzip upload exceeds the limit (default 3072 KiB, Workers Free; set `WORKER_LIMIT_KIB` for paid).
- Current foundation bundle: **1050 KiB gzip** (about 34% of the free cap). Re-check after every phase; PDF.js, charts and i18n dictionaries will add to it.
- `npm run cf:preview` runs the Worker locally; `npm run cf:deploy` deploys (needs `wrangler login`).

## Compatibility findings
1. **`proxy.ts` is not used.** Next 16 renamed middleware to `proxy` and it runs on the Node.js runtime. OpenNext prints "Node.js middleware support is experimental in cloudflare". We therefore keep the edge `src/middleware.ts` (deprecated warning in the Next build, but supported and bundled by OpenNext). Revisit when OpenNext supports Node proxy officially. Moving to a VPS later makes the rename trivial (`middleware.ts` to `proxy.ts`, export `proxy`).
2. **Images:** `next/image` optimisation is off (`images.unoptimized`) because Workers has no sharp. Use pre-sized WebP assets or Cloudflare Images.
3. **Windows:** OpenNext warns it is not fully supported on Windows. The build succeeded here, but run production builds in CI (Linux) or WSL.
4. **Caching:** no incremental cache override is configured. Add an R2 or KV binding in `open-next.config.ts` before using ISR or `revalidate`.
5. Secrets are never in `wrangler.jsonc`. Use `wrangler secret put SUPABASE_SECRET_KEY`; public values via `[vars]` or the dashboard.

## Portability
Only `open-next.config.ts`, `wrangler.jsonc`, the `cf:*` scripts and the `initOpenNextCloudflareForDev()` line in `next.config.ts` are Cloudflare-specific. Remove them and use `next build && next start` to run on any Node host.

## Not yet verified
Runtime behaviour on a live Worker (needs a Cloudflare account/deploy), custom domains/SSL for white-label academies (Cloudflare for SaaS may be a paid feature), and CPU-time limits under real load.
