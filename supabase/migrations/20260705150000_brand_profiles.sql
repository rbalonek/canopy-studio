-- brand_profiles: the AI-analyzed (and human-edited) brand knowledge per
-- client, populated by the website_analysis job from scraped pages and
-- consumed by every generation task.
--
-- edited_fields tracks which columns a human has touched — re-running
-- the analysis only fills fields the user hasn't customized, so a fresh
-- scrape can never clobber curated brand voice or guidelines.
--
-- Design signals (palette / fonts / logo) are extracted mechanically by
-- the scraper, staged on scraped_domains, and copied here on analysis.
-- They're heuristics: presented as "detected", always editable.

create table if not exists brand_profiles (
  client_id        text primary key references clients(id) on delete cascade,
  description      text,
  customer_avatars text,
  brand_voice      text,
  dos              text,
  donts            text,
  additional_notes text,
  -- ["#0A5F55", ...] most-used first
  palette          jsonb,
  -- [{ "family": "Inter", "source": "google-fonts" | "css" }, ...]
  fonts            jsonb,
  logo_url         text,
  edited_fields    jsonb not null default '{}'::jsonb,
  analyzed_at      timestamptz,
  updated_at       timestamptz not null default now()
);

alter table brand_profiles enable row level security;

create policy "brand_profiles read for members" on brand_profiles
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = brand_profiles.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "brand_profiles insert for members" on brand_profiles
  for insert to authenticated with check (
    exists (
      select 1 from clients c
      where c.id = brand_profiles.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "brand_profiles update for members" on brand_profiles
  for update to authenticated using (
    exists (
      select 1 from clients c
      where c.id = brand_profiles.client_id and is_workspace_member(c.workspace_id)
    )
  ) with check (
    exists (
      select 1 from clients c
      where c.id = brand_profiles.client_id and is_workspace_member(c.workspace_id)
    )
  );

-- Design signals staged by the scraper on the domain rollup.
alter table scraped_domains add column if not exists raw_palette jsonb;
alter table scraped_domains add column if not exists raw_fonts jsonb;
alter table scraped_domains add column if not exists logo_url text;
