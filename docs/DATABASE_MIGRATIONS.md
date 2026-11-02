# Database Migrations

Files live in `supabase/migrations/` and run in filename order.

| File | Contents |
|---|---|
| 20261101000001_identity_tenancy | profiles, platform_admins, academies, memberships, RLS helpers, `register_academy()` |
| 20261101000002_catalog_library_copyright | boards/levels/subjects, resources, `copyright_permissions`, guard triggers, `resource_legally_allows()` |
| 20261101000003_entitlements_access | entitlements, `has_entitlement()`, `can_access_resource()` |
| 20261101000004_storage_audit | storage buckets + policies, audit log |

All four are **additive** (CREATE only; no DROP, TRUNCATE or data deletion). They are not yet applied anywhere.

## Migration 8: manual payments
`20261102000008_manual_payments.sql` adds plans, payment methods, payments, the private `payment-proofs` bucket and the five payment functions. Additive only (no DROP). Not idempotent: run it once. Applied-check: `select to_regprocedure('public.approve_payment(uuid,text)') is not null;`

## Migration 9: premium scope and ledger
`20261103000009_ledger_and_premium_scope.sql` replaces `can_access_resource` and `approve_payment` in place (CREATE OR REPLACE, same signatures), adds the ledger tables, and posts ledger entries for any payment already approved. No DROP, no data deleted. Run it once, after migration 8.

## Migration 10: academy registration
`20261103000010_academy_registration.sql` adds `academies.status_note`, replaces `register_academy` (validation, reserved addresses, at most 3 academies in review or active per person, audit row) and `academies_guard` (staff can no longer change status, owner, slug or the reviewer note) in place, and adds `review_academy` (super admin only, note required unless approving, audited). No DROP, no data deleted. Run once, after migration 9.

## Safety checklist before applying (I will run through this with you)
1. Confirm the project URL host starts with the ref in `EXPECTED_SUPABASE_PROJECT_REF` and is the new `education-platform` project.
2. Inspect its state: it should contain no tables in `public`.
3. Review each migration together; I will explain any operation that could affect data (none are destructive).
4. You confirm. Only then: `npx supabase link --project-ref <ref>` then `npx supabase db push` (or paste each file into the SQL editor in order).
5. Create the first super admin by running, in the SQL editor, `insert into platform_admins (user_id) values ('<your auth user id>');` after you sign up.

## Testing without a project
`npm test` runs these exact migrations in an in-process Postgres (PGlite) with a stand-in for Supabase's `auth`/`storage` schemas. It proves RLS and copyright logic, but it is not Supabase itself. Re-run the checks against the real project after the first push.

## Still to come (later phases)
Courses, commerce/ledger, assessments, certificates, CMS/SEO tables, support and notifications. Not in Phase 2.
