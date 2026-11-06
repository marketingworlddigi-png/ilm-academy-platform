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

## Is it applied? Check query (migrations 5 to 21)
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
    and to_regclass('public.academy_invites') is not null                                                       as m15_teachers_progress,
  to_regprocedure('public.review_course(uuid,text,text)') is not null
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'video_url') as m16_course_review_video,
  to_regprocedure('public.submit_quiz_attempt(uuid,jsonb)') is not null
    and to_regclass('public.quiz_options') is not null                                                         as m17_quizzes,
  to_regprocedure('public.ask_question(uuid,text)') is not null
    and to_regclass('public.lesson_answers') is not null                                                       as m18_lesson_qa,
  to_regprocedure('public.submit_assignment(uuid,text)') is not null
    and to_regclass('public.assignment_submissions') is not null                                               as m19_assignments,
  to_regprocedure('public.claim_certificate(uuid)') is not null
    and to_regclass('public.certificates') is not null                                                         as m20_certificates,
  to_regclass('public.lesson_notes') is not null                                                               as m21_lesson_notes;
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

## Migration 16: course review and lesson video
`20261107000016_course_review_and_video.sql` adds `lessons.video_url` (https and an allowlisted host only: YouTube, Vimeo, Bunny), review columns on `courses`, `submit_course_for_review`, `withdraw_course_submission` and `review_course`, and replaces `courses_guard` in place. No DROP, no data deleted.
- Academies can no longer publish directly: Publish became "Submit for review". Only a super admin can approve (which publishes) or send back with a note. Every step is audited.
- Courses already published keep running; their review status is `none`.

## Migration 17: quizzes
`20261108000017_quizzes.sql` adds `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `get_quiz` and `submit_quiz_attempt`. Additive only. No DROP.
- One quiz per lesson, single-choice, 50 questions and 6 options at most, one correct option per question.
- Teachers (owner, admin, instructor) write quizzes in their own academy. The answer key is readable only by them and super admins.
- Learners never read the quiz tables. `get_quiz` returns the quiz without the key; `submit_quiz_attempt` marks it on the server, stores the attempt and then returns the right answers. 30 attempts per quiz per day.

## Migration 18: lesson questions and answers
`20261109000018_lesson_qa.sql` adds `lesson_questions`, `lesson_answers`, `lesson_qa`, `ask_question`, `post_answer` and `set_qa_hidden`. Additive only. No DROP.
- Read: anyone who can open the lesson, plus the academy's teachers and super admins. Post: enrolled learners and the academy's teachers. 10 questions and 30 answers per person per day.
- Names are a first-name snapshot taken when posting, so profiles stay private.
- Teachers hide and unhide posts (audited as `qa.hidden` / `qa.unhidden`). Hidden posts vanish for learners.

## Migration 19: assignments
`20261110000019_assignments.sql` adds `assignments`, `assignment_submissions`, `get_assignment`, `submit_assignment`, `list_submissions` and `grade_submission`. Additive only. No DROP.
- One assignment per lesson, written by the academy's teachers. Learners hand in plain text (up to 5000 characters), only if enrolled, and can replace it until it is marked.
- Teachers mark with a whole-number score up to the assignment's total plus feedback (audited as `assignment.graded`). Marked work is locked for the learner.
- Learners read only their own submission; teachers see names as first names only.

## Migration 20: certificates
`20261111000020_certificates.sql` adds `certificates`, `certificate_status`, `claim_certificate`, `verify_certificate` and `revoke_certificate`. Additive only. No DROP.
- Earned when the learner is enrolled, has completed every lesson and passed every quiz in the course. Assignments do not block it.
- Name, course and academy are copied at issue time. The learner needs a full name on their profile first.
- `verify_certificate(code)` is callable without signing in and returns only name, course, academy and date. The 12-character code comes from a random UUID.
- Academy owners/admins and super admins can withdraw a certificate with a reason (audited). A withdrawn code stops verifying and is not re-issued.

## Migration 21: lesson notes
`20261112000021_lesson_notes.sql` adds `lesson_notes`. Additive only. One private plain-text note per learner per lesson (up to 5000 characters). Only the author can read it, not even the academy's teachers, and only for lessons they can open.

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
