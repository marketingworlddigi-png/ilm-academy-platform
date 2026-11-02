# Multi-Tenancy Guide

Shared database, shared schema; tenant rows carry `academy_id`. Access is decided by `is_super_admin()`, `has_academy_role()` and `is_academy_staff()` (SECURITY DEFINER, empty search_path).

Isolation tests (tests/db) prove: academy B cannot see academy A's memberships, permission records, unpublished resources, or upload into its storage folder; cannot edit academy A; cannot self-join.

Hostname-to-academy resolution (subdomains/custom domains, `academy_domains` table) is planned for Phase 7; the edge middleware currently handles locale only.

## Academy registration and dashboard (as built)
- A signed-in user registers at `/academy/register`, which calls `register_academy()`. The academy starts `pending`; the caller becomes owner. Platform admins review it at `/admin/academies` through `review_academy()`; only `active` academies are public and can serve content.
- `/academy` lists the academies a person owns or administers; `/academy/[slug]` is the staff-only dashboard (status and reviewer note, member counts, details form, content list). Students get a 404 there even when the academy is active.
- Staff edit only name and description. Status, owner, slug and the reviewer note are protected by `academies_guard`.
- Academy payment review (when academies can sell) is owner/admin of that academy only, enforced in the SQL function and RLS, never only in the UI. Not built yet.
