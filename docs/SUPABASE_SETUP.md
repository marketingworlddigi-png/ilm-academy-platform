# Supabase Setup (dedicated "education-platform" project)

This app must use its own Supabase project. Never point it at any other project. Nothing has been applied to any database yet.

## Steps for you
1. supabase.com/dashboard -> **New project** -> name `education-platform`. Pick a region near Pakistan users (e.g. Singapore or Mumbai if offered). Save the database password in a password manager (not in this repo or chat).
2. Open **Project Settings -> API Keys**. Copy the **Project URL** and the **publishable key** (`sb_publishable_...`). Do not copy the secret key now.
3. In the project folder: copy `.env.example` to `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Set `EXPECTED_SUPABASE_PROJECT_REF` to the part of the URL before `.supabase.co`. The app refuses to start requests if the URL does not match.
4. **Authentication -> URL configuration:** site URL `http://localhost:3000` for now; add the production URL later. Enable email confirmations (Authentication -> Providers -> Email).
5. Tell me when done (do not paste keys). I will then follow the safety checklist in DATABASE_MIGRATIONS.md before anything is applied.

## Keys
- Publishable key: safe in the browser; protected by RLS.
- Secret key: server only, only if a privileged task needs it. Store with `wrangler secret put`, never in `NEXT_PUBLIC_*`, git or chat.
