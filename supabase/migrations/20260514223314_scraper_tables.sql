-- Tables that back the website scraper port from Swimm-Copywriting-API.
-- The Edge Function (scrape-client) discovers pages from robots.txt +
-- sitemap.xml + the homepage's links, fetches a small set, parses HTML,
-- and writes the extracted title/content here.

create table if not exists scraped_pages (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null references clients(id) on delete cascade,
  url         text not null,
  title       text,
  -- Extracted main-content text (≤ ~20kb per page in practice). Used to
  -- brief Claude for ad copy / brand profile generation.
  content     text,
  -- Inferred kind (home / about / services / pricing / blog / etc.) so the
  -- UI can rank + group. NULL until we add classification.
  kind        text,
  status      text default 'analyzed'
              check (status in ('analyzed', 'pending', 'failed')),
  word_count  integer,
  scraped_at  timestamptz not null default now(),
  unique (client_id, url)
);

create index if not exists scraped_pages_client_id_idx on scraped_pages(client_id);

-- One row per scraped domain — captures sitemap discovery state, last
-- crawl time, page count.
create table if not exists scraped_domains (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null references clients(id) on delete cascade,
  domain      text not null,
  health      text default 'Healthy'
              check (health in ('Healthy', 'Warnings', 'Stale', 'Error')),
  sitemap_status text default 'Discovered'
              check (sitemap_status in ('Discovered', 'Partial', 'Failed')),
  pages_discovered integer default 0,
  pages_indexed    integer default 0,
  last_crawled_at  timestamptz,
  created_at       timestamptz not null default now(),
  unique (client_id, domain)
);

create index if not exists scraped_domains_client_id_idx on scraped_domains(client_id);

alter table scraped_pages   enable row level security;
alter table scraped_domains enable row level security;

-- Read: workspace member of the parent client. Writes via service role
-- only (from the scrape-client Edge Function).
create policy "scraped_pages read for workspace members" on scraped_pages
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = scraped_pages.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "scraped_domains read for workspace members" on scraped_domains
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = scraped_domains.client_id and is_workspace_member(c.workspace_id)
    )
  );
