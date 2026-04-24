-- Seed data mirroring src/data/mock.ts for the tables introduced in
-- migration 20260424193212_init_core.sql. Supabase runs this automatically
-- on `supabase start` and `supabase db reset` (local only).

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
insert into clients (id, name, industry, complete, is_parent) values
  ('acme',      'Acme Dental',                 'Dental / Healthcare',    86, true),
  ('seaside',   'Seaside Yoga',                'Fitness / Wellness',     72, false),
  ('northside', 'Northside Auto Group',        'Automotive',             54, true),
  ('bloom',     'Bloom & Vine Florist',        'Retail / E-commerce',    91, false),
  ('kettle',    'Kettle & Crumb Bakery',       'Food & Beverage',        44, false),
  ('harbor',    'Harbor Legal Partners',       'Professional Services',  66, false),
  ('pine',      'Pinecrest Family Dentistry',  'Dental / Healthcare',    38, false),
  ('lumen',     'Lumen Eyecare',               'Optometry',              78, false),
  ('summit',    'Summit Roofing Co.',          'Home Services',          60, false);

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------
insert into locations (id, client_id, name, address, mtd_spend, active_campaigns, posts_per_week, complete) values
  ('acme-dt',  'acme',      'Acme Dental — Downtown', '284 Ember Row',    '$8,210',  6, 3, 92),
  ('acme-mt',  'acme',      'Acme Dental — Midtown',  '1420 Oak Blvd',    '$6,420',  4, 2, 81),
  ('acme-ws',  'acme',      'Acme Dental — Westside', '55 Cedar Lane',    '$3,790',  3, 2, 74),
  ('nsa-ford', 'northside', 'Northside Ford',         '9014 Route 44',    '$24,120', 5, 1, 58),
  ('nsa-kia',  'northside', 'Northside Kia',          '9016 Route 44',    '$18,760', 4, 1, 51);

-- ---------------------------------------------------------------------------
-- client_card_stats
-- ---------------------------------------------------------------------------
insert into client_card_stats (client_id, mtd_spend, active_campaigns, posts_per_week) values
  ('acme',      '$18,420', 6, 4),
  ('seaside',   '$6,210',  3, 3),
  ('northside', '$42,880', 9, 2),
  ('bloom',     '$3,940',  2, 5),
  ('kettle',    '$1,210',  1, 1),
  ('harbor',    '$9,620',  4, 2),
  ('pine',      '$4,180',  2, 2),
  ('lumen',     '$7,340',  3, 3),
  ('summit',    '$2,910',  2, 2);

-- ---------------------------------------------------------------------------
-- client_kpis — 4 rows per client
-- ---------------------------------------------------------------------------
insert into client_kpis (client_id, metric, value, delta, seed) values
  -- acme
  ('acme',      'spend',       '$18,420',  12.4, 3),
  ('acme',      'conversions', '142',       8.1, 5),
  ('acme',      'roas',        '3.8×',      4.0, 2),
  ('acme',      'cpl',         '$48',      -2.2, 9),
  -- seaside
  ('seaside',   'spend',       '$6,210',   -6.1, 7),
  ('seaside',   'conversions', '58',       -3.4, 4),
  ('seaside',   'roas',        '2.4×',     -1.2, 6),
  ('seaside',   'cpl',         '$31',       2.1, 8),
  -- northside
  ('northside', 'spend',       '$42,880',   4.2, 11),
  ('northside', 'conversions', '68',        2.4, 3),
  ('northside', 'roas',        '5.2×',      1.8, 5),
  ('northside', 'cpl',         '$184',     -0.6, 7),
  -- bloom
  ('bloom',     'spend',       '$3,940',   18.3, 5),
  ('bloom',     'conversions', '112',      22.4, 2),
  ('bloom',     'roas',        '4.1×',      6.0, 4),
  ('bloom',     'cpl',         '$12',      -8.4, 6),
  -- kettle
  ('kettle',    'spend',       '$1,210',  -22.0, 2),
  ('kettle',    'conversions', '28',      -18.1, 8),
  ('kettle',    'roas',        '1.9×',     -4.2, 3),
  ('kettle',    'cpl',         '$22',       6.1, 5),
  -- harbor
  ('harbor',    'spend',       '$9,620',    8.7, 9),
  ('harbor',    'conversions', '41',        4.2, 6),
  ('harbor',    'roas',        '6.8×',      2.1, 4),
  ('harbor',    'cpl',         '$96',      -1.8, 7),
  -- pine
  ('pine',      'spend',       '$4,180',   -2.4, 4),
  ('pine',      'conversions', '29',       -1.2, 5),
  ('pine',      'roas',        '2.1×',      0.4, 3),
  ('pine',      'cpl',         '$62',       1.1, 6),
  -- lumen
  ('lumen',     'spend',       '$7,340',    6.0, 6),
  ('lumen',     'conversions', '71',        3.8, 3),
  ('lumen',     'roas',        '3.4×',      1.4, 5),
  ('lumen',     'cpl',         '$38',      -2.0, 7),
  -- summit
  ('summit',    'spend',       '$2,910',    1.2, 8),
  ('summit',    'conversions', '18',        2.8, 2),
  ('summit',    'roas',        '2.8×',      0.6, 9),
  ('summit',    'cpl',         '$162',     -1.4, 4);

-- ---------------------------------------------------------------------------
-- meta_accounts
-- ---------------------------------------------------------------------------
insert into meta_accounts (client_id, account_id) values
  ('acme',      'act_139204882'),
  ('seaside',   'act_140118723'),
  ('northside', 'act_137904412'),
  ('bloom',     'act_141220077'),
  ('harbor',    'act_138991045'),
  ('lumen',     'act_142018330');

-- ---------------------------------------------------------------------------
-- client_perf — workspace-wide perf snapshot
-- ---------------------------------------------------------------------------
insert into client_perf (client_id, spend, conv, roas, cpl, spark, status, delta) values
  ('acme',      '$18,420', 142, '3.8x',  '$48',   3, 'Active',  12.4),
  ('seaside',   '$6,210',   58, '2.4x',  '$31',   7, 'Active',  -6.1),
  ('northside', '$42,880',  68, '5.2x',  '$184', 11, 'Active',   4.2),
  ('bloom',     '$3,940',  112, '4.1x',  '$12',   5, 'Active',  18.3),
  ('kettle',    '$1,210',   28, '1.9x',  '$22',   2, 'Paused', -22.0),
  ('harbor',    '$9,620',   41, '6.8x',  '$96',   9, 'Active',   8.7),
  ('pine',      '$4,180',   29, '2.1x',  '$62',   4, 'Active',  -2.4),
  ('lumen',     '$7,340',   71, '3.4x',  '$38',   6, 'Active',   6.0);

-- ---------------------------------------------------------------------------
-- urgent_issues
-- ---------------------------------------------------------------------------
insert into urgent_issues (sev, title, body) values
  ('red',
   'CPL 3.2× higher than account avg on Acme Dental → Leads | ASO | April',
   'This campaign has spent $4,820 with 12 conversions this week — budget pacing will exhaust daily cap by Friday. Consider pausing the underperforming ad set "ASO — Broad".'),
  ('amber',
   'Bloom & Vine CTR dropped 28% week-over-week',
   'Creative fatigue likely — all 3 active ads are >14 days old. Generate 2–3 new variations grounded in the top performer from March.'),
  ('amber',
   'Northside Kia has no conversions in last 7 days',
   'Tracking pixel may be misfiring. 4 campaigns active, $8,420 spend, zero reported conversions. Verify META pixel events.');
