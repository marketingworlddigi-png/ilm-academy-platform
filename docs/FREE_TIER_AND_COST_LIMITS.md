# Free Tier and Cost Limits

Figures come from web searches on 2026-11-01. Several were third-party and disagreed; confirm on official pricing pages before launch. "Free" is not "unlimited".

| Service | Free allowance (reported) | Risk |
|---|---|---|
| Supabase | ~500 MB DB, 1 GB storage, 50k MAU, 2 projects; egress reported as 0.5 / 2 / 5 GB by different sources; **pauses after ~7 days inactivity** | Pause is unacceptable for paying users: plan Pro (~$25/mo) before taking payments |
| Cloudflare Workers | compressed bundle 3 MiB free / 10 MiB paid (one Cloudflare post says 15 MiB); request and CPU-time limits apply | Current bundle 1.05 MiB; watch growth |
| Cloudflare R2 | 10 GB-month, 1M Class A, 10M Class B ops, no egress fees | Overage ~$0.015/GB-month |
| Cloudflare Workers Paid | ~$5/mo | Likely needed for scale/cron |

Free-tier PDFs: 1 GB Supabase storage fills quickly; move bulk files to R2 behind the same signed-URL interface when needed.
Sources: developers.cloudflare.com/r2/pricing, opennext.js.org/cloudflare, jetadmin.io and activepieces.com Supabase pricing posts.
