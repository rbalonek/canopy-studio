-- Multiple-location detection.
--
-- The scraper now records the raw material for detection (nav links +
-- the full discovered-URL list) on scraped_domains; a `location_detection`
-- AI job classifies which of those URLs are per-location pages (e.g.
-- bigairusa.com/asheville vs bigairusa.com/birthdays) and stages them in
-- `location_suggestions` for one-click confirmation in the Locations tab.
-- Confirmed locations carry their site URL, and their pages can be scraped
-- + tagged via scraped_pages.location_id so location-scoped AI jobs are
-- grounded in that location's own content.

-- Locations gain the URL of their section of the client's site.
alter table locations add column if not exists url text;

-- Allow per-workspace AI settings for the new task.
alter table ai_settings drop constraint if exists ai_settings_task_check;
alter table ai_settings add constraint ai_settings_task_check check (task in (
  'copy_generation', 'creative_directions', 'expand_content',
  'regenerate_single', 'website_analysis', 'location_detection',
  'competitor_analysis', 'account_analysis', 'report_summary', 'test_prompt'
));

-- Scraped pages can belong to a specific location (own-site only; null for
-- site-wide pages and competitor pages). SET NULL on delete: removing a
-- location must not destroy the scraped content itself.
alter table scraped_pages
  add column if not exists location_id text references locations(id) on delete set null;
create index if not exists scraped_pages_location_id_idx on scraped_pages(location_id);

-- Raw detection material captured during discovery scrapes:
--   nav_links       [{ url, text }] — same-site anchors from the unstripped
--                   homepage (nav/header/footer included — that's where
--                   location pickers live).
--   discovered_urls [url, ...]      — the sitemap/crawl discovery set
--                   (capped), so detection sees pages beyond the few that
--                   were actually scraped, and so location subpages
--                   (/asheville/birthdays) can be found when a location is
--                   confirmed.
alter table scraped_domains add column if not exists nav_links jsonb;
alter table scraped_domains add column if not exists discovered_urls jsonb;

-- Detected-but-unconfirmed locations. Written by the location_detection
-- job (service role); members read them, confirm ("added"), or dismiss.
create table if not exists location_suggestions (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null references clients(id) on delete cascade,
  name        text not null,
  url         text not null,
  confidence  integer not null default 50 check (confidence between 0 and 100),
  status      text not null default 'pending'
              check (status in ('pending', 'added', 'dismissed')),
  detected_at timestamptz not null default now(),
  unique (client_id, url)
);
create index if not exists location_suggestions_client_id_idx
  on location_suggestions(client_id);

alter table location_suggestions enable row level security;

-- Members read + resolve (add/dismiss) suggestions; inserts come from the
-- detection job via service role only, so there is no insert policy.
create policy "location_suggestions read for workspace members" on location_suggestions
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = location_suggestions.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "location_suggestions update for workspace members" on location_suggestions
  for update to authenticated using (
    exists (
      select 1 from clients c
      where c.id = location_suggestions.client_id and is_workspace_member(c.workspace_id)
    )
  ) with check (
    exists (
      select 1 from clients c
      where c.id = location_suggestions.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "location_suggestions delete for workspace members" on location_suggestions
  for delete to authenticated using (
    exists (
      select 1 from clients c
      where c.id = location_suggestions.client_id and is_workspace_member(c.workspace_id)
    )
  );
