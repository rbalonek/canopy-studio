-- Scheduled publishing for content posts.
--
-- Approve → Schedule puts a post in the queue for its scheduled_date/time:
--   - Facebook supports NATIVE scheduling (published=false +
--     scheduled_publish_time), so the post lands in Meta's own Content
--     Library → Scheduled tab and Meta publishes it — fb_scheduled_post_id
--     records the handle so a cancel can delete it.
--   - Instagram's publishing API has NO scheduling, so IG goes into
--     pending_channels and a pg_cron tick (every 5 min → cron-dispatch
--     'posts_due' → publish-meta-post mode 'due') publishes it when
--     publish_at arrives. This is how every third-party scheduler does IG;
--     the post appears on IG at the time, but never in Meta's scheduled list.
--
-- publish_at is an absolute timestamptz computed in the browser from the
-- post's civil date+time in the scheduler's timezone — the cron and Meta
-- both need an instant, and the browser is the only place that knows the
-- intended zone.

alter table content_posts add column if not exists publish_at timestamptz;
alter table content_posts add column if not exists pending_channels text[] not null default '{}';
alter table content_posts add column if not exists fb_scheduled_post_id text;

create index if not exists content_posts_due_idx
  on content_posts (publish_at) where status = 'scheduled';

-- Audit rows for scheduling + cancels.
alter table post_publishes drop constraint if exists post_publishes_status_check;
alter table post_publishes add constraint post_publishes_status_check check (
  status in ('publishing', 'published', 'partial', 'failed', 'scheduled', 'canceled')
);

-- Every 5 minutes: publish whatever is due (IG pending channels; FB-native
-- rows just flip to published — Meta already did the work). Same Vault
-- secrets as the other cron jobs.
do $$
begin
  perform cron.unschedule('canopy-posts-due');
exception when others then
  null; -- not scheduled yet
end $$;

select cron.schedule(
  'canopy-posts-due',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_functions_url') || '/cron-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Internal-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'canopy_internal_fn_secret')
    ),
    body := jsonb_build_object('task', 'posts_due')
  );
  $$
);
