-- Ad sets + ads tables for the campaign drill-down (campaign → ad sets
-- → ads). Mirrors ad-optimizer's schema (single-period for v1; we'll
-- layer multi-period columns when we wire the date picker).

create table if not exists ad_sets (
  id            text primary key,
  campaign_id   text not null references campaigns(id) on delete cascade,
  client_id     text not null references clients(id) on delete cascade,
  ad_account_id text,

  name              text,
  status            text,
  optimization_goal text,

  daily_spend            numeric default 0,
  mtd_spend              numeric default 0,
  daily_results          numeric default 0,
  daily_result_type      text,
  daily_cost_per_result  numeric default 0,
  mtd_results            numeric default 0,
  mtd_result_type        text,
  mtd_cost_per_result    numeric default 0,
  all_daily_actions jsonb default '{}'::jsonb,
  all_mtd_actions   jsonb default '{}'::jsonb,

  impressions numeric default 0,
  clicks      numeric default 0,
  cpc         numeric default 0,
  cpm         numeric default 0,
  ctr         numeric default 0,

  last_refreshed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists ad_sets_campaign_id_idx on ad_sets(campaign_id);
create index if not exists ad_sets_client_id_idx on ad_sets(client_id);

create table if not exists ads (
  id             text primary key,
  ad_set_id      text not null references ad_sets(id) on delete cascade,
  campaign_id    text not null references campaigns(id) on delete cascade,
  client_id      text not null references clients(id) on delete cascade,
  ad_account_id  text,

  name     text,
  status   text,

  daily_spend            numeric default 0,
  mtd_spend              numeric default 0,
  daily_results          numeric default 0,
  daily_result_type      text,
  daily_cost_per_result  numeric default 0,
  mtd_results            numeric default 0,
  mtd_result_type        text,
  mtd_cost_per_result    numeric default 0,
  all_daily_actions jsonb default '{}'::jsonb,
  all_mtd_actions   jsonb default '{}'::jsonb,

  impressions numeric default 0,
  clicks      numeric default 0,
  cpc         numeric default 0,
  cpm         numeric default 0,
  ctr         numeric default 0,

  last_refreshed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists ads_ad_set_id_idx on ads(ad_set_id);
create index if not exists ads_campaign_id_idx on ads(campaign_id);
create index if not exists ads_client_id_idx on ads(client_id);

-- RLS: read for workspace members of the parent client, writes via
-- service role from the Edge Function.
alter table ad_sets enable row level security;
alter table ads     enable row level security;

create policy "ad_sets read for workspace members" on ad_sets
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = ad_sets.client_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "ads read for workspace members" on ads
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = ads.client_id and is_workspace_member(c.workspace_id)
    )
  );
