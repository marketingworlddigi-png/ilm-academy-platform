# Authentication and RLS

## Roles
- **super_admin**: row in `platform_admins` (created only by database owner/service role).
- **academy_owner / academy_admin / instructor / student**: rows in `memberships`, scoped per academy. A user can hold different roles in different academies.

## Key rules (all tested in `tests/db`)
- Users create academies only via `register_academy()`; status starts `pending`. Only super admins change `status` or `owner_id` (trigger).
- Admins cannot create owners; only owners can create admins; nobody can add themselves to another academy.
- Entitlements are written only by super admins or server code with the secret key.
- `audit_logs` is append-only for clients and filled by triggers.
- `anon` can read only published catalog rows, active academies and published resource metadata.

## App code
- `src/lib/supabase/server.ts`: per-request user client (RLS applies). Use by default.
- `src/lib/supabase/admin.ts`: bypasses RLS; server-only; use only for audited jobs.
- UI hiding is convenience only; every rule above is enforced in the database.

## Not yet built
Sign-up/login/reset screens and email verification flows (Phase 3, needs the live project).
