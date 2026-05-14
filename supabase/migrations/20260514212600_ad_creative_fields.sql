-- Creative-level metadata on the ads table so the Ad Detail page can
-- show the destination URL, headline, body, thumbnail, and call-to-action
-- without needing another API round-trip per view.

alter table ads add column if not exists creative_id     text;
alter table ads add column if not exists destination_url text;
alter table ads add column if not exists headline        text;
alter table ads add column if not exists body            text;
alter table ads add column if not exists thumbnail_url   text;
alter table ads add column if not exists image_url       text;
alter table ads add column if not exists call_to_action  text;
-- The raw creative payload from Meta — keep it for forward compatibility
-- so we can pull additional fields (carousels, dynamic creative variants,
-- etc.) without another migration.
alter table ads add column if not exists creative_raw    jsonb;
