-- Initial core schema covering the data behind Overview, Clients, and the
-- Client Detail header + Overview tab. More tables (campaigns, ad sets,
-- assets, brand, competitors, etc.) land in follow-up migrations so each
-- step can be reviewed on its own.
--
-- Design notes
--  - IDs are `text` and match the string ids already used in mock.ts
--    (acme, seaside, bloom, ...). Production will move to uuids; keeping
--    text for now makes the seed data a direct copy of the fixtures.
--  - Numeric columns we display as formatted strings ("$18,420", "3.8x")
--    stay as text for now. They're already formatted in the views; moving
--    to numeric with per-column formatters is a later refactor.
--  - RLS is enabled on every table. For this early stage the policies
--    allow anon read only — the publishable key can SELECT, nothing else.
--    Writes will require auth once we add real users.

set search_path = public;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table clients (
  id          text primary key,
  name        text not null,
  industry    text not null,
  complete    smallint not null check (complete between 0 and 100),
  is_parent   boolean not null default false,
  created_at  timestamptz not null default now()
);
comment on table clients is 'Top-level client (or location, in Business mode) records.';
comment on column clients.complete is 'Brand-completeness 0-100 (drives the Ring component).';
comment on column clients.is_parent is 'True when the client has sub-locations.';

-- ---------------------------------------------------------------------------
-- locations (child rows under parent clients)
-- ---------------------------------------------------------------------------
create table locations (
  id                text primary key,
  client_id         text not null references clients(id) on delete cascade,
  name              text not null,
  address           text not null,
  mtd_spend         text not null,
  active_campaigns  integer not null default 0,
  posts_per_week    integer not null default 0,
  complete          smallint not null check (complete between 0 and 100),
  created_at        timestamptz not null default now()
);
create index locations_client_id_idx on locations (client_id);

-- ---------------------------------------------------------------------------
-- client_card_stats — the aggregate stats shown on the Clients grid cards
-- ---------------------------------------------------------------------------
create table client_card_stats (
  client_id         text primary key references clients(id) on delete cascade,
  mtd_spend         text not null,
  active_campaigns  integer not null default 0,
  posts_per_week    integer not null default 0
);
comment on table client_card_stats is
  'Per-client aggregates; in production this is a view or materialized view.';

-- ---------------------------------------------------------------------------
-- client_kpis — 4 rows per client (spend / conversions / roas / cpl)
-- ---------------------------------------------------------------------------
create table client_kpis (
  client_id  text not null references clients(id) on delete cascade,
  metric     text not null check (metric in ('spend','conversions','roas','cpl')),
  value      text not null,
  delta      real not null,
  seed       integer not null,
  primary key (client_id, metric)
);

-- ---------------------------------------------------------------------------
-- meta_accounts — primary META ad account id per client
-- ---------------------------------------------------------------------------
create table meta_accounts (
  client_id   text primary key references clients(id) on delete cascade,
  account_id  text not null
);

-- ---------------------------------------------------------------------------
-- client_perf — workspace-wide perf snapshot shown on Overview
-- ---------------------------------------------------------------------------
create table client_perf (
  client_id  text primary key references clients(id) on delete cascade,
  spend      text not null,
  conv       integer not null,
  roas       text not null,
  cpl        text not null,
  spark      integer not null,
  status     text not null,
  delta      real not null
);

-- ---------------------------------------------------------------------------
-- urgent_issues — the "Urgent issues" panel on Overview
-- ---------------------------------------------------------------------------
create table urgent_issues (
  id          bigserial primary key,
  sev         text not null check (sev in ('red','amber')),
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: enable on everything, allow anon read (writes gated later)
-- ---------------------------------------------------------------------------
alter table clients             enable row level security;
alter table locations           enable row level security;
alter table client_card_stats   enable row level security;
alter table client_kpis         enable row level security;
alter table meta_accounts       enable row level security;
alter table client_perf         enable row level security;
alter table urgent_issues       enable row level security;

create policy anon_read on clients           for select to anon using (true);
create policy anon_read on locations         for select to anon using (true);
create policy anon_read on client_card_stats for select to anon using (true);
create policy anon_read on client_kpis       for select to anon using (true);
create policy anon_read on meta_accounts     for select to anon using (true);
create policy anon_read on client_perf       for select to anon using (true);
create policy anon_read on urgent_issues     for select to anon using (true);
