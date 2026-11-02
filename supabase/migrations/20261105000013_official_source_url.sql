-- Migration 13: optional link to the publisher's or author's official page for a resource. Additive only: one nullable column.
-- The book page shows a "Read on official website" button when the resource has no file readable on this site.
-- The database accepts only absolute http(s) links without spaces, so a stored value can never be a javascript: or data: URL.

alter table public.resources add column official_source_url text
  check (official_source_url is null or (char_length(official_source_url) <= 500 and official_source_url ~* '^https?://[^\s/]+[^\s]*$'));
