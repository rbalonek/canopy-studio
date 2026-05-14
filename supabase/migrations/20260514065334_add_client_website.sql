-- Add clients.website — the site URL captured during onboarding (and
-- eventually scraped to auto-fill brand info / discover pages / etc).
-- Nullable since not every client has a website, and the field is
-- optional in onboarding.

alter table clients add column website text;
