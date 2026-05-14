-- Each location is typically a single Facebook Page + Instagram Business
-- account under the parent client's Meta connection. The page_id +
-- ig_business_account_id pair are what we need at the location level —
-- the access_token / ad_account_id stay on meta_accounts (per client)
-- so one user/system-user token grants access to all the pages.

alter table locations add column if not exists page_id text;
alter table locations add column if not exists instagram_business_account_id text;

-- The wireframe runtime stats (mtd_spend, active_campaigns, posts_per_week,
-- complete) were defined NOT NULL. Adding defaults so the Add Location
-- form can leave them at zero values without listing every column in
-- the insert.
alter table locations alter column mtd_spend set default '$0';
alter table locations alter column active_campaigns set default 0;
alter table locations alter column posts_per_week set default 0;
alter table locations alter column complete set default 0;
