# Environment Variables

| Variable | Scope | Notes |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | public | Project URL of the education-platform project |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | public | `sb_publishable_...`, protected by RLS |
| SUPABASE_SECRET_KEY | server only | optional; `wrangler secret put` in production; never `NEXT_PUBLIC_` |
| EXPECTED_SUPABASE_PROJECT_REF | server | guard against the wrong project |
| NEXT_PUBLIC_SITE_URL | public | canonical base URL |
| WORKER_LIMIT_KIB | build | bundle check limit (default 3072) |

`.env.local` is git-ignored; `.env.example` has placeholders only.
