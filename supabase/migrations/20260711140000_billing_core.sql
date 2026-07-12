-- Billing core: USD credit ledger + plan state + Stripe webhook idempotency.
--
-- Model (ports the donor app's flat floor/markup pricing, fixes its two
-- fragilities — client-triggered payment verification and dual balance
-- bookkeeping that could drift):
--   * ai_usage_events gains billed_usd (what WE charge, vs cost_usd = raw
--     provider estimate) and key_source ('workspace' BYO key = small
--     platform fee, 'platform' = full pricing).
--   * credit_ledger is the single append-only source of truth. Positive
--     deltas: subscription grants, top-ups, postpaid invoice payments.
--     Negative: usage. billing_accounts.balance_usd is a trigger-maintained
--     cache of the sum, never written by hand.
--   * stripe_events makes webhook processing idempotent (Stripe retries).
--   * A workspace with NO billing_accounts row is not billing-enabled:
--     usage is recorded but nothing is blocked. Turning billing on for a
--     tenant = giving them a row (subscribe flow does this automatically).

create table if not exists billing_accounts (
  workspace_id           uuid primary key references workspaces(id) on delete cascade,
  stripe_customer_id     text unique,
  plan                   text not null default 'none'
                         check (plan in ('none', 'starter', 'pro', 'friends_family')),
  stripe_subscription_id text,
  plan_status            text not null default 'inactive',
  -- Friends & family: no monthly fee until this instant; usage accrues
  -- negative and is invoiced monthly / at threshold.
  ff_expires_at          timestamptz,
  balance_usd            numeric(12,4) not null default 0,
  updated_at             timestamptz not null default now()
);

create table if not exists credit_ledger (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  delta_usd      numeric(12,4) not null,
  kind           text not null check (kind in
                 ('usage', 'subscription_grant', 'topup', 'postpaid_invoice', 'adjustment')),
  usage_event_id uuid references ai_usage_events(id) on delete set null,
  stripe_ref     text,
  memo           text,
  created_at     timestamptz not null default now()
);

create index if not exists credit_ledger_workspace_idx
  on credit_ledger (workspace_id, created_at desc);

-- Webhook idempotency: one row per Stripe event id ever processed.
create table if not exists stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

alter table ai_usage_events add column if not exists billed_usd numeric(10,6) not null default 0;
alter table ai_usage_events add column if not exists key_source text not null default 'platform';

-- Ledger insert → balance cache. Upsert so the very first usage row
-- bootstraps the billing_accounts row (plan 'none', not billing-enforced
-- until a real plan is set — see the no-row semantics above; a row with
-- plan 'none' and no Stripe ids behaves the same for enforcement).
create or replace function apply_credit_ledger_delta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into billing_accounts (workspace_id, balance_usd, updated_at)
  values (new.workspace_id, new.delta_usd, now())
  on conflict (workspace_id) do update
    set balance_usd = billing_accounts.balance_usd + new.delta_usd,
        updated_at  = now();
  return new;
end $$;

drop trigger if exists credit_ledger_apply_delta on credit_ledger;
create trigger credit_ledger_apply_delta
  after insert on credit_ledger
  for each row execute function apply_credit_ledger_delta();

alter table billing_accounts enable row level security;
alter table credit_ledger enable row level security;
alter table stripe_events enable row level security;

-- Members can see their plan/balance/ledger. ALL writes are service-role
-- only (webhooks, usage recorder, billing cycle) — no client write policies.
create policy "billing_accounts read for members" on billing_accounts
  for select to authenticated using (is_workspace_member(workspace_id));

create policy "credit_ledger read for members" on credit_ledger
  for select to authenticated using (is_workspace_member(workspace_id));
-- stripe_events: service-role only, no policies at all.

-- Daily billing cycle: postpaid (friends & family) invoicing — monthly on
-- the 1st for any negative balance, any day once past the -$25 threshold.
-- The dispatch function no-ops harmlessly until Stripe secrets exist.
select cron.schedule(
  'canopy-billing-cycle',
  '0 8 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_functions_url') || '/cron-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_internal_fn_secret')
    ),
    body := jsonb_build_object('task', 'billing_cycle')
  );
  $$
);
