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

-- Fold competitor_id into the uniqueness so competitor pages are keyed per
-- competitor, not per client. The old unique(client_id, url) meant two
-- competitors of the same client that shared a URL — or a competitor page
-- whose URL matched one of the client's own pages — collided, and the second
-- write was silently dropped. NULLS NOT DISTINCT (Postgres 15+) keeps the
-- client-owned rows (competitor_id IS NULL) de-duplicated as before, so the
-- client-side upsert on (client_id, url, competitor_id) still coalesces them.
alter table scraped_pages drop constraint if exists scraped_pages_client_id_url_key;
alter table scraped_pages add constraint scraped_pages_client_url_competitor_key
  unique nulls not distinct (client_id, url, competitor_id);

alter table scraped_domains drop constraint if exists scraped_domains_client_id_domain_key;
alter table scraped_domains add constraint scraped_domains_client_domain_competitor_key
  unique nulls not distinct (client_id, domain, competitor_id);

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
