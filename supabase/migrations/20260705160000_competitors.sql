-- Competitors: tracked rivals per client, scraped with the same crawler
-- as the client's own site and analyzed against the brand profile.
--
-- Scraped content reuses scraped_pages / scraped_domains with a nullable
-- competitor_id. Competitor scrapes are delete-then-insert (not upsert)
-- so the existing (client_id, url/domain) unique constraints — which
-- can't express "unique per competitor" without partial-index inference
-- PostgREST doesn't support — never fight the writes.

create table if not exists competitors (
  id              uuid primary key default gen_random_uuid(),
  client_id       text not null references clients(id) on delete cascade,
  domain          text not null,
  name            text,
  -- { "instagram": "...", "facebook": "..." } — stored for future Meta
  -- Ad Library integration; social pages can't be scraped directly.
  socials         jsonb,
  enabled         boolean not null default true,
  last_scraped_at timestamptz,
  -- Latest competitor_analysis output:
  -- { positioning_summary, comparison_rows[], takeaway }
  analysis        jsonb,
  analyzed_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (client_id, domain)
);

alter table competitors enable row level security;

create policy "competitors read for members" on competitors
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = competitors.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "competitors insert for members" on competitors
  for insert to authenticated with check (
    exists (
      select 1 from clients c
      where c.id = competitors.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "competitors update for members" on competitors
  for update to authenticated using (
    exists (
      select 1 from clients c
      where c.id = competitors.client_id and is_workspace_member(c.workspace_id)
    )
  ) with check (
    exists (
      select 1 from clients c
      where c.id = competitors.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "competitors delete for members" on competitors
  for delete to authenticated using (
    exists (
      select 1 from clients c
      where c.id = competitors.client_id and is_workspace_member(c.workspace_id)
    )
  );

-- Competitor scrapes share the scraper tables.
alter table scraped_pages add column if not exists competitor_id uuid references competitors(id) on delete cascade;
alter table scraped_domains add column if not exists competitor_id uuid references competitors(id) on delete cascade;

-- gap_angles: "what the competitor does that you don't (or vice versa)"
-- — regenerated per competitor on each analysis run.
create table if not exists gap_angles (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null references clients(id) on delete cascade,
  competitor_id uuid references competitors(id) on delete cascade,
  title         text not null,
  confidence    int not null default 50 check (confidence between 0 and 100),
  evidence      text,
  created_at    timestamptz not null default now()
);

alter table gap_angles enable row level security;

create policy "gap_angles read for members" on gap_angles
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = gap_angles.client_id and is_workspace_member(c.workspace_id)
    )
  );
-- Writes: service role only (the analysis job).
