-- Live campaigns table — first cut of the Meta integration port. Schema
-- mirrors ad-optimizer's `campaigns` table (the original project's
-- migration 001_initial_schema.sql) but scopes to canopystudio's
-- client_id model and adds RLS.
--
-- Subsequent migrations will add ad_sets, ads, monthly_data, and
-- multi-period spend columns (this_week / last_week / last_month).
-- Keeping this commit narrow so the Edge Function can land in parallel.

create table if not exists campaigns (
  -- Meta's campaign ID (e.g. "120206123456789012")
  id            text primary key,
  client_id     text not null references clients(id) on delete cascade,
  -- Denormalized for query speed; mirrors the ad account the campaign lives in
  ad_account_id text,

  name          text,
  status        text,
  objective     text,
  -- Parsed from the campaign name (Lead / ATC / VC / Traffic / Video View /
  -- Purchase / Sales / Conversion) — more accurate than Meta's own
  -- "objective" field in practice. See ad-optimizer/server/services/meta.js.
  strategy      text,

  -- Spend by period (USD assumed for v1; multi-currency later)
  daily_spend   numeric default 0,
  mtd_spend     numeric default 0,

  -- Primary results (conversion count for whichever action type matches the
  -- campaign strategy — purchase / lead / add_to_cart / etc).
  daily_results            numeric default 0,
  daily_result_type        text,
  daily_cost_per_result    numeric default 0,
  mtd_results              numeric default 0,
  mtd_result_type          text,
  mtd_cost_per_result      numeric default 0,

  -- Full action map (jsonb) — every action type Meta returned, raw counts.
  -- Lets the UI surface secondary KPIs without another API call.
  all_daily_actions jsonb default '{}'::jsonb,
  all_mtd_actions   jsonb default '{}'::jsonb,

  -- Standard ad metrics (most-recent insight window, MTD)
  impressions   numeric default 0,
  clicks        numeric default 0,
  cpc           numeric default 0,
  cpm           numeric default 0,
  ctr           numeric default 0,
  reach         numeric default 0,
  frequency     numeric default 0,
  roas          numeric default 0,

  -- Refresh accounting
  last_refreshed_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists campaigns_client_id_idx on campaigns(client_id);
create index if not exists campaigns_status_idx on campaigns(status);
create index if not exists campaigns_last_refreshed_idx on campaigns(last_refreshed_at);

-- RLS — read for workspace members of the parent client; writes only via
-- service_role from the Edge Function (no policy granted to authenticated).
alter table campaigns enable row level security;

create policy "campaigns read for workspace members" on campaigns
  for select to authenticated using (
    exists (
      select 1 from clients c
      where c.id = campaigns.client_id and is_workspace_member(c.workspace_id)
    )
  );
