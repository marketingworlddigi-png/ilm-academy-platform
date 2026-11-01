# Copyright and Distribution Policy

No book, note or PDF is distributed without recorded permission. Defaults are the most restrictive.

## Record (table `copyright_permissions`, one per resource)
copyright owner, original source, publication year, license type, permission status, evidence reference/file, verified_at, verified_by, allow_online_view, allow_download, allow_commercial, attribution, expires_at, restrictions.
(Title, author, publisher, edition are on `resources`.)

## Statuses
not_reviewed, pending_verification, permission_requested, approved, rejected, expired, restricted, removed.

## Enforced rules
1. New resources start `not_reviewed` with view, download and commercial all off.
2. Only super admins can set a status beyond pending/requested, change any allow flag, or set expiry. Verifier and time are stamped by the database.
3. `approved` requires verifier, time and evidence. Any allow flag requires `approved`; leaving `approved` clears all flags automatically.
4. A resource cannot be published without approved, unexpired permission.
5. Download needs both allow_download and allow_online_view. Premium (paid) resources need allow_commercial; premium entitlements never override copyright.
6. An expired date disables access immediately, with no job needed. (The `expired` status label is set by an admin or a later scheduled job.)
7. Academy staff can request review and attach evidence, but editing evidence on an approved record requires a super admin.
8. Suspended academies' resources are inaccessible. Every permission change is audit-logged.

## Process (human)
Collect written permission or licence, record the reference, a super admin verifies, then approves. Religious/legal questions about a specific publisher's rights are outside this software; obtain written permission.
