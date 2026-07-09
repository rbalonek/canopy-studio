-- post_publishes: audit trail for organic content_posts published to Meta
-- (Facebook Page feed + Instagram media). One row per publish attempt; the
-- Graph object ids land here as each channel succeeds, so a partial publish
-- (FB posted, IG failed) is diagnosable and not silently retried.
--
-- Unlike ad_publishes, these go LIVE immediately — organic posts have no
-- paused state. The button is gated to approved posts and is a deliberate,
-- confirmed, one-time action.

create table if not exists post_publishes (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  client_id        text not null references clients(id) on delete cascade,
  content_post_id  uuid references content_posts(id) on delete set null,
  page_id          text,
  ig_user_id       text,
  channels         text[] not null default '{}',
  -- Graph ids as they come back:
  fb_post_id       text,
  ig_media_id      text,
  -- 'published' = every requested channel succeeded; 'partial' = some did,
  -- some didn't (error names which); 'failed' = none did.
  status           text not null default 'publishing'
                   check (status in ('publishing', 'published', 'partial', 'failed')),
  error            text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  published_at     timestamptz
);

create index if not exists post_publishes_workspace_idx
  on post_publishes (workspace_id, created_at desc);
create index if not exists post_publishes_content_post_idx
  on post_publishes (content_post_id);

alter table post_publishes enable row level security;

create policy "post_publishes read for members" on post_publishes
  for select to authenticated using (is_workspace_member(workspace_id));
-- Writes: service role only (the publish-meta-post Edge Function).
