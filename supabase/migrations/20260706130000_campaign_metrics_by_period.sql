-- Multi-period campaign metrics.
--
-- The flat mtd_* columns only ever hold the current calendar month. That hides
-- performance for campaigns whose conversions land in a prior period (e.g. a
-- Purchase campaign with sales last month but none yet this month), and it
-- deprives the AI analysis of the cross-period comparisons it needs.
--
-- metrics_by_period stores a compact object per period — this_month /
-- last_month / last_30d — each with the standard insight fields plus the raw
-- { action_type: count } map. The flat mtd_* columns stay (populated from
-- this_month) for backward compatibility.

alter table campaigns add column if not exists metrics_by_period jsonb not null default '{}'::jsonb;
