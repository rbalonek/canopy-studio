-- Per-page controls for the website scraper.
--
-- Two things a member can now do to a scraped page from the Scraped Pages
-- tab, without triggering a full re-crawl:
--   1. Exclude it. `excluded` has three states:
--        'none'   — active; re-scraped + fed to the AI (the default).
--        'scrape' — skip on re-scrape but KEEP the last recorded content and
--                   still feed it to the AI. ("just exclude scraping")
--        'all'    — skip on re-scrape AND withhold the content from the AI.
--                   ("exclude content and scraping")
--   2. Edit the extracted text. `content_edited` marks a page whose content a
--      human has hand-tuned, so a later re-scrape preserves it instead of
--      overwriting (mirrors brand_profiles.edited_fields).
--
-- Writes to scraped_pages are otherwise service-role-only, so both actions go
-- through the SECURITY DEFINER RPCs below (same pattern as
-- set_campaign_strategy): they verify workspace membership first and only
-- touch the intended columns.

alter table scraped_pages
  add column if not exists excluded text not null default 'none'
    check (excluded in ('none', 'scrape', 'all'));

alter table scraped_pages
  add column if not exists content_edited boolean not null default false;

-- Set a page's exclusion state. Membership-checked; touches only `excluded`.
create or replace function set_scraped_page_exclusion(p_page_id uuid, p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
begin
  if p_mode not in ('none', 'scrape', 'all') then
    raise exception 'Invalid exclusion mode: %', p_mode;
  end if;

  select c.workspace_id into v_workspace
  from scraped_pages sp
  join clients c on c.id = sp.client_id
  where sp.id = p_page_id;

  if v_workspace is null then
    raise exception 'Scraped page not found';
  end if;
  if not is_workspace_member(v_workspace) then
    raise exception 'Not authorized to edit this page';
  end if;

  update scraped_pages
  set excluded = p_mode
  where id = p_page_id;
end;
$$;

grant execute on function set_scraped_page_exclusion(uuid, text) to authenticated;

-- Replace a page's extracted content. Membership-checked; recomputes
-- word_count and flags the row as human-edited so re-scrapes preserve it.
create or replace function set_scraped_page_content(p_page_id uuid, p_content text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
  v_trimmed text := btrim(coalesce(p_content, ''));
  v_words integer;
begin
  select c.workspace_id into v_workspace
  from scraped_pages sp
  join clients c on c.id = sp.client_id
  where sp.id = p_page_id;

  if v_workspace is null then
    raise exception 'Scraped page not found';
  end if;
  if not is_workspace_member(v_workspace) then
    raise exception 'Not authorized to edit this page';
  end if;

  v_words := case
    when v_trimmed = '' then 0
    else coalesce(array_length(regexp_split_to_array(v_trimmed, E'\\s+'), 1), 0)
  end;

  update scraped_pages
  set content = p_content,
      word_count = v_words,
      content_edited = true
  where id = p_page_id;
end;
$$;

grant execute on function set_scraped_page_content(uuid, text) to authenticated;
