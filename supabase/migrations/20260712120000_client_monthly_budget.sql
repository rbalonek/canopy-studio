-- Per-client monthly ad budget (USD) for the Overview budget-pacing card:
-- MTD spend vs. budget with an on-track / over / under projection. Member-
-- editable like the rest of the client row (clients already has member
-- update RLS); null = no budget set, pacing hidden for that client.

alter table clients add column if not exists monthly_budget numeric;
