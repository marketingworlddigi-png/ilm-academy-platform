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

## Migration 11: resubmit for review
`20261104000011_resubmit_academy.sql` adds `resubmit_academy(uuid)` (owner only; needs_info or rejected back to pending; same 3-academy cap; audited) and replaces `academies_guard` in place so only that function can make the transition, through a transaction-local flag. No DROP, no data deleted.

## Is it applied? Check query (migrations 5 to 15)
Run in the Supabase SQL editor. Every column must be `true`:
```sql
select
  exists (select 1 from pg_trigger where tgname = 'resources_insert_guard_trg' and not tgisinternal)            as m5_resources_insert_guard,
  to_regprocedure('public.resource_permission_valid(uuid)') is not null
    and to_regprocedure('public.soft_delete_resource(uuid)') is not null                                       as m6_resource_admin,
  to_regprocedure('public.public_resource_info(uuid)') is not null                                             as m7_public_resource_info,
  to_regprocedure('public.approve_payment(uuid,text)') is not null
    and to_regclass('public.payments') is not null                                                             as m8_manual_payments,
  to_regclass('public.ledger_entries') is not null
    and to_regprocedure('public.post_payment_ledger(uuid,uuid)') is not null                                   as m9_ledger,
  to_regprocedure('public.review_academy(uuid,academy_status,text)') is not null                               as m10_academy_review,
  to_regprocedure('public.resubmit_academy(uuid)') is not null                                                 as m11_resubmit,
  to_regprocedure('public.enroll_in_course(uuid)') is not null
    and to_regclass('public.lessons') is not null                                                               as m12_courses,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'resources' and column_name = 'official_source_url') as m13_official_source_url,
  to_regprocedure('public.plan_purchase_preview(uuid,uuid,integer)') is not null
    and to_regprocedure('public.platform_period_start(uuid)') is not null                                       as m14_plan_purchase_rules,
  to_regprocedure('public.complete_lesson(uuid)') is not null
    and to_regclass('public.academy_invites') is not null                                                       as m15_teachers_progress;
```
Add one clause per new migration.

## Migration 12: courses
`20261104000012_courses.sql` adds courses, modules, lessons and enrollments with row-level security, `course_outline`, `enroll_in_course` and `leave_course`. Courses are public only while published and their academy is active; lesson text is readable only by that academy's owner/admin, super admins, enrolled users, and for lessons marked as a free preview. Enrollment rows are written only through the two functions. No DROP, no data deleted.

## Migration 13: official website link
`20261105000013_official_source_url.sql` adds one nullable column, `resources.official_source_url` (absolute http or https links only, enforced by a check constraint). The book page shows "Read on official website" when it is set and the site has no readable file. No DROP, no data deleted.

## Migration 14: plan purchase rules
`20261105000014_plan_purchase_rules.sql` adds `platform_period_start` and `plan_purchase_preview`, and replaces `create_payment` and `approve_payment` in place (same signatures, grants kept). No table changes, nothing dropped. The plan behind a Premium period is read through `entitlements.payment_id` to `payments.plan_id`.
- Same plan cannot be bought again until the last 7 days before it ends (the end of the latest period of that plan, so stacked periods count).
- A different plan can be bought any time and starts when the current Premium ends.
- A submitted or under-review payment blocks new ones. An unpaid payment for the same plan is reused; an unpaid one for another plan is cancelled (audited as `payment.cancelled`).
- Dates on the pricing, checkout and admin screens come from `plan_purchase_preview`, which uses the same start-date function as `approve_payment`.

## Migration 15: teachers, invitations, lesson progress
`20261106000015_teachers_and_progress.sql` is additive; it replaces five course-content policies (courses_read, modules_read/write, lessons_read/write, enrollments_read) so teachers (membership role `instructor`) can work in their own academy. No data is touched.
- Teachers: create and edit modules and lessons, see draft courses and the roster of their own academy. They cannot create, publish or archive courses, edit the academy, or manage members.
- Invitations: `invite_to_academy` (owner or admin invite teachers; only the owner invites admins) returns a single-use link token once; only its SHA-256 is stored. `accept_invite` joins the signed-in user with the invited role. Email is not sent by the platform yet, so the inviter shares the link. Anyone holding the link can accept it until it is used, revoked, replaced or 14 days old.
- Progress: `record_lesson_position`, `complete_lesson` (returns the next lesson) and `course_progress`. Clients can only read their own rows; teachers read their academy's.

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
