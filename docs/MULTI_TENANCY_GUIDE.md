# Multi-Tenancy Guide

Shared database, shared schema; tenant rows carry `academy_id`. Access is decided by `is_super_admin()`, `has_academy_role()` and `is_academy_staff()` (SECURITY DEFINER, empty search_path).

Isolation tests (tests/db) prove: academy B cannot see academy A's memberships, permission records, unpublished resources, or upload into its storage folder; cannot edit academy A; cannot self-join.

Hostname-to-academy resolution (subdomains/custom domains, `academy_domains` table) is planned for Phase 7; the edge middleware currently handles locale only.
