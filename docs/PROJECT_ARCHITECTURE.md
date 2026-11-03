# Multi-Academy Education Marketplace & LMS: Architecture and Implementation Plan

Status: Phase 1 (Discovery and Architecture). No application code exists yet.
Working name: `ilm-academy-platform` (placeholder; rename freely).

## 1. Current project state

- `d:\GitHub` is not a git repo. A search of it found no existing Darse Nizami, academy or LMS project, so this is greenfield.
- Toolchain on this machine: Node v24.16.0, npm 11.13.0, Windows 10.
- Known constraint from earlier builds: the machine has low RAM, and `next dev` often OOMs. Plan to verify with `next build` + `next start` and keep dependencies lean.
- Git will be initialised inside the project folder.

## 2. Recommended final architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + React + TypeScript | Server rendering for SEO, route-level i18n, server actions for secured mutations |
| UI | Tailwind CSS + shadcn/ui + Lucide + custom design tokens | Matches the brief; RTL via logical properties (`ms-`, `ps-`, `start-`) |
| Forms | React Hook Form + Zod (same schemas on client and server) | Required by the brief |
| DB / Auth | Supabase Postgres + Auth + RLS | Required by the brief; RLS is the real tenant boundary |
| Files | Storage behind an adapter interface; Supabase Storage first, Cloudflare R2 as a drop-in | Premium files are private and served by short-lived signed URLs |
| Video | External host (Bunny Stream / YouTube unlisted / Vimeo) behind a `VideoProvider` interface | Never store video on the app server |
| PDF | PDF.js viewer, with pages streamed through an entitlement-checked route | |
| Hosting | **Decision needed**, see section 8 | |
| Tests | Vitest (unit), pgTAP or SQL-based RLS tests, Playwright (E2E) | |

Code organisation: a single Next.js app, modular by domain (`src/modules/{identity,tenancy,catalog,library,courses,learning,commerce,ledger,seo,cms,support,notifications}`). Each module has its own schema, services and Zod validators. No microservices for the MVP.

## 3. Database ER plan (grouped)

All tenant-scoped tables carry `academy_id` (nullable only for platform-owned rows). Every table has `id uuid pk`, `created_at`, `updated_at`; soft-delete (`deleted_at`) on content, never on ledger rows.

- **Identity:** `profiles` (1:1 with `auth.users`), `roles`, `permissions`, `role_permissions`, `memberships` (user, academy, role, status). A user can hold different roles in different academies.
- **Tenancy:** `academies`, `academy_branding`, `academy_domains` (hostname, verification token, status, ssl_status), `academy_applications`, `instructor_profiles`, `instructor_applications`.
- **Catalog (config-driven, not hardcoded):** `boards`, `levels` (class/year), `subjects`, `categories`, `board_levels`, `level_subjects`.
- **Library:** `books` (trilingual titles, author, publisher, edition, language, `license_type`, `copyright_owner`, `distribution_permission`, `access_type`), `book_chapters`, `resources` (file/video/audio/link), `book_resources`, `related_items`.
- **Courses:** `courses`, `course_modules`, `lessons`, `lesson_resources`, `course_reviews` (verified enrollment required).
- **Commerce:** `plans`, `plan_benefits`, `products` (polymorphic: course, book, bundle, plan), `bundles`, `bundle_items`, `coupons`, `orders`, `order_items`, `payments` (status machine, method, reference, proof file), `payment_reviews`, `subscriptions`.
- **Entitlements:** `entitlements` (user, grant source, scope type/id, starts_at, expires_at, status, source order or coupon or sponsor). Access is resolved by one SQL function `has_access(user, scope_type, scope_id)`. No `isPremium` flag.
- **Ledger:** `ledger_accounts`, `ledger_entries` (append-only, double-entry, signed amounts in integer paisa), `commission_rules`, `earnings`, `payouts`, `payout_items`, `refunds`.
- **Learning:** `enrollments`, `lesson_progress`, `bookmarks`, `notes`, `favorites`, `reading_progress`, `question_banks`, `questions`, `quizzes`, `exams`, `attempts`, `attempt_answers`, `assignments`, `submissions`, `grades`, `certificates` (public verification code), `certificate_templates`, `discussions`.
- **Support / comms:** `notifications`, `notification_preferences`, `tickets`, `ticket_messages`, `announcements`.
- **CMS / SEO:** `articles` (+ `article_revisions`, editorial status, reviewer, references), `faqs`, `seo_metadata` (polymorphic: entity type, id, locale), `keywords`, `keyword_groups`, `keyword_page_map`, `content_calendar`, `seo_audit_runs`, `seo_audit_issues`, `redirects`, `media_assets`.
- **Platform:** `audit_logs` (append-only), `analytics_events`, `integrations`, `platform_settings`, `free_access_limits`.

Key invariants (enforced in the database, not only app code):
- Money is stored as integer paisa. Ledger rows are insert-only (no UPDATE or DELETE grants), and each transaction group balances to zero.
- Payment approval runs in one SQL function (`approve_payment`) that, in a single transaction, locks the payment, checks the actor's permission, creates entitlements, writes ledger entries and writes the audit log. It is idempotent.
- Prices and commissions are computed in that function and in server code only.

## 4. Authentication and permission model

- Supabase Auth with email verification and password reset. Cookies are handled via `@supabase/ssr`.
- **RBAC + scoped permissions.** Roles: `super_admin`, `academy_admin`, `instructor`, `student`, plus later `editor`, `subject_reviewer`, `seo_reviewer`, `support_agent`. Permissions are strings (`payment.approve`, `course.publish`). Role-permission mapping lives in tables. Membership scopes a role to an academy (or to the platform).
- Authorization happens at three layers: (1) RLS policies, (2) server actions and route handlers that call `requirePermission(scope, permission)`, (3) UI hiding for convenience only.
- The service-role key is used only in server-only modules (`import "server-only"`), never in the client bundle. Privileged writes go through SECURITY DEFINER functions with explicit permission checks.
- Sensitive religious content (Fiqh, Hadith, Tafseer, rulings) is gated in the publishing workflow: it cannot move to `published` without a `subject_reviewer` sign-off recorded.

## 5. Multi-tenant isolation strategy

- Shared database, shared schema, `academy_id` on every tenant row. This is the cheapest option that fits the free tier. Schema-per-tenant would be much heavier on one small Postgres instance.
- RLS helper functions: `is_super_admin()`, `has_academy_role(academy_id, role)`, `has_permission(academy_id, permission)`. Policies default to deny.
- Tenant resolution at the edge: `middleware` maps `Host` to an academy (`academy.platform.com` subdomain, or a verified custom domain in `academy_domains`), then rewrites to `/_academy/[academyId]/...`. Custom domains need DNS verification (TXT record) before activation. SEO canonicals always use the verified primary domain.
- Test requirement: an RLS test suite that logs in as academy A's admin and tries every table for academy B's rows. That suite must pass before any phase is marked complete.

## 6. SEO and multilingual architecture

- URLs: `/en-pk/...`, `/ur-pk/...`, `/ar/...` via a `[locale]` segment. Localized slugs are stored per locale in `seo_metadata`. Each language version has a stable URL (no IP-based switching), with `hreflang` + `x-default` and self-referencing canonicals.
- `generateMetadata` reads from `seo_metadata` with template fallbacks. JSON-LD is built from database rows and only emits properties visible on the page. No invented ratings, prices or accreditation.
- Sitemap index plus child sitemaps (courses, academies, articles, books, resources, per locale). `robots.txt` blocks dashboards and checkout. Private pages send `noindex` headers.
- Thin pages are not indexed: a page is added to the sitemap only when it passes a minimum-content check.
- Search Console and GA4 are OAuth integrations. Dashboards show only fetched data, with an empty state when not connected.
- Fonts: Noto Naskh Arabic / Noto Nastaliq Urdu for RTL, with `dir` set per locale.
- Keyword module stores user-entered keywords only. It never fabricates volume or difficulty.

## 7. Payments

Manual first: bank transfer, JazzCash, Easypaisa. The student submits a reference and proof, and an authorized admin reviews it. The status machine is `pending → submitted → under_review → approved | rejected`, plus `refunded | cancelled | expired`. A `PaymentProvider` interface is defined now so gateways and signed webhooks can be added later. No card data is ever stored.

**As built (migration 8, `20261102000008_manual_payments.sql`).** Tables `plans`, `payment_methods`, `payments`; `entitlements.payment_id` (unique, so one payment can only ever create one entitlement). Plans and methods ship inactive and empty; an admin fills in real prices and account details before anything is offered.

- Prices come from `plans` inside `create_payment`; the client never sends an amount. The plan name, months and price are copied onto the payment so later price edits do not rewrite history.
- Clients can only SELECT their own payments. Every write goes through a SECURITY DEFINER function: `create_payment`, `submit_payment`, `claim_payment_review`, `approve_payment`, `reject_payment`.
- Duplicate transaction IDs are refused (normalised: case, spaces and dashes ignored) by a partial unique index over submitted, under-review, approved and refunded payments. A rejected payment frees its ID.
- `approve_payment` is super-admin only, refuses the admin's own payment, locks the row, is idempotent (a second call returns the same entitlement), stacks renewals after the current expiry and writes an audit log row. `reject_payment` requires a reason and cannot undo an approval.
- Proofs live in the private `payment-proofs` bucket at `<user_id>/<payment_id>/proof.<ext>`; only the owner (while pending) can upload and only the owner or a super admin can read. Admins view them through 5-minute signed URLs.
- `can_access_resource` is unchanged: Premium access is the entitlement check, so an expired entitlement loses access automatically. Premium books also need `allow_commercial` on their permission record.
- Not built yet: refunds (`refunded` status exists), expiry reminders, gateway provider, ledger screens.

**Premium scope and ledger (migration 9, `20261103000009_ledger_and_premium_scope.sql`).**
- `can_access_resource`: platform Premium now opens only platform-owned premium books (`academy_id is null`). An academy's premium books need an academy-scoped or resource-scoped entitlement, so academies are paid for what they sell. The legal gate and every other rule are unchanged.
- `ledger_accounts` and `ledger_entries`: append-only, double-entry, signed integer paisa (debit positive, credit negative). A trigger blocks UPDATE, DELETE and TRUNCATE for every role including the owner; a deferred constraint trigger refuses any transaction group that does not sum to zero; a unique index stops the same payment being posted twice. Clients have SELECT only (super admins, and later each academy's staff for that academy's accounts). Writes happen only inside SECURITY DEFINER functions.
- `approve_payment` now calls `post_payment_ledger` in the same transaction: debit `platform:receipts`, credit `platform:subscription_revenue`. Mistakes are fixed with a correcting entry, never an edit.
- Academy payment review (planned for the academy phase): academy_owner / academy_admin of that academy only, enforced by RLS and by the function checking the payment's academy, never by the UI.

## 8. Hosting and free-tier strategy (needs your decision)

Figures below come from search results. Several are third-party and conflict, so confirm them on the official pages before launch.

- **Supabase free:** about 500 MB database, 1 GB file storage, 50,000 MAU, 2 active projects. The project **pauses after about 7 days of inactivity**. Egress figures conflict between sources (2, 5 or 0.5 GB). Not official pages: [Jetadmin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Activepieces](https://www.activepieces.com/blog/supabase-pricing-free-tier-limits-pro-costs-egress.md).
- **Cloudflare R2:** 10 GB-month storage, 1M Class A and 10M Class B operations per month, no egress fees ([official pricing](https://developers.cloudflare.com/r2/pricing)). Best place for PDFs once 1 GB of Supabase storage runs out.
- **Next.js on Cloudflare Workers (OpenNext adapter):** the compressed Worker size cap is 3 MiB on the free plan and 10 MiB on paid. One Cloudflare post says 15 MiB, so confirm ([OpenNext docs](https://opennext.js.org/cloudflare)). A full LMS bundle with a PDF viewer and charts may exceed 3 MiB, so the free Workers tier is a real risk.

Options:
1. **Vercel Hobby** for the Next.js app: full Next.js support, but the Hobby plan is non-commercial by Vercel's terms, so it is unsuitable for a paid marketplace.
2. **Cloudflare Workers via OpenNext**: free if the bundle fits 3 MiB, otherwise $5/month paid plan. Closest to the brief.
3. **Self-host on a small VPS** (Node + `next start`): predictable, no bundle cap, small monthly cost.

Recommendation: develop against Supabase free, deploy to Cloudflare Workers via OpenNext, and measure the bundle in Phase 2. Budget for the Workers paid plan ($5/month) and Supabase Pro ($25/month) before taking real money, because a paused database is not acceptable for a paid product. Do not describe the stack as unlimited free.

## 9. Risks

1. Copyright: Darse Nizami books are often under publisher copyright. Every book requires license fields, and downloads are blocked unless `distribution_permission` is set.
2. Free-tier ceilings: DB size (500 MB), the Supabase inactivity pause and the Workers bundle cap.
3. Tenant data leakage via RLS mistakes. Mitigated by default-deny policies and the cross-tenant test suite.
4. Manual payment fraud or errors: mitigated by single-transaction approval, audit logs and duplicate-reference checks.
5. Protected-file bypass via guessable URLs: private buckets plus signed URLs only.
6. RTL/Urdu/Arabic quality and translation quality: human-reviewed translations only.
7. Scope: this brief is many months of work. Phased delivery with tests per phase is the only safe approach.
8. Local machine RAM limits builds and dev server.
9. Custom domains and SSL on Workers or Vercel need provider-specific setup (Cloudflare for SaaS or similar), which may incur costs.

## 10. Phases

Follow the brief's Phases 2–9. Each phase ends with tests, a docs update and a short report.

## 11. Prioritized checklist

**Essential for MVP**
- [ ] Project scaffold, design tokens, i18n routing (en-pk / ur-pk / ar, RTL)
- [ ] Supabase schema migrations: identity, tenancy, catalog, library
- [ ] Auth (signup, verify, reset), profiles, RBAC, RLS and the cross-tenant test suite
- [ ] Super Admin: boards, levels, subjects, books CRUD (with license fields)
- [ ] Public site: home, library, book, subject and board pages, with SEO metadata, sitemap and robots
- [ ] Entitlement engine plus free-access limits
- [ ] Manual payment workflow, `approve_payment` function, ledger
- [ ] Signed-URL PDF delivery and reader

**Required for first public launch**
- [ ] Academy and instructor onboarding workflows
- [ ] Course builder, approval, player, progress
- [ ] Plans, coupons, subscriptions with expiry reminders
- [ ] Quizzes, assignments, certificates with public verification
- [ ] Notifications (in-app and email), support tickets
- [ ] Article CMS with the review workflow, structured data, hreflang
- [ ] Legal pages (privacy, terms, copyright, refund)
- [ ] Security checklist, E2E tests, backups

**Advanced**
- [ ] Revenue sharing, earnings and payouts UI
- [ ] SEO audit crawler, keyword module, content calendar
- [ ] Search Console and GA4 integrations
- [ ] Academy-level analytics, internal-link recommendations

**Future expansion**
- [ ] Custom domains with automated SSL
- [ ] Payment gateways and webhooks, automated payouts
- [ ] SMS and WhatsApp, multi-currency
- [ ] School, college and professional categories
- [ ] Mobile app

## 12. Questions for the project owner before Phase 2

1. Hosting: Cloudflare Workers (OpenNext), VPS, or something else?
2. Is a Supabase project already created? If not, I will use local Supabase (needs Docker) for migrations and tests.
3. Which content do you already hold distribution rights for?

## 13. Courses (slice 1, migration 12)
- Tables: `courses` (per academy, slug unique per academy), `course_modules`, `lessons` (plain text body, optional linked library book, free-preview flag), `enrollments`.
- Visibility is enforced in row-level security, not in the pages: a course and its modules are public only while the course is published and its academy is active. Lesson text is readable by that academy's owner/admin, super admins, enrolled users, and for free-preview lessons. `course_outline()` exposes lesson titles only, so the syllabus can be public without the content.
- Rules in triggers: a new course starts as a draft; publishing needs an active academy and at least one lesson; a published course keeps at least one lesson and its web address; a lesson can link a platform book or its own academy's book, never another academy's.
- Enrollment is free and goes only through `enroll_in_course` / `leave_course` (idempotent; the academy can remove a student, which is final from the student's side).
- Pages: public `/courses`, `/courses/[academy]/[course]`, members-only `/courses/[academy]/[course]/lessons/[id]` (noindex, in robots.txt); staff manage under `/academy/[slug]/courses`.
- Not in slice 1: paid courses, lesson progress, instructors authoring (staff are owner/admin only), inviting students, reordering by drag.
