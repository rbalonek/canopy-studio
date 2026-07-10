-- Editable campaign strategy.
--
-- meta-refresh-client derives `strategy` from the campaign name/objective on
-- every refresh. This lets a member override it and have the override survive
-- future refreshes: `strategy_custom` marks a row as manually set, and the
-- refresh preserves the strategy of any row where it's true.

alter table campaigns add column if not exists strategy_custom boolean not null default false;

-- Members set a campaign's strategy (and only that) through this RPC. It's
-- SECURITY DEFINER so it can write the otherwise service-role-only campaigns
-- table, but it first verifies the caller is a member of the campaign's client
-- workspace and only ever touches strategy + strategy_custom.
create or replace function set_campaign_strategy(p_campaign_id text, p_strategy text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace uuid;
begin
  select c.workspace_id into v_workspace
  from campaigns cm
  join clients c on c.id = cm.client_id
  where cm.id = p_campaign_id;

  if v_workspace is null then
    raise exception 'Campaign not found';
  end if;
  if not is_workspace_member(v_workspace) then
    raise exception 'Not authorized to edit this campaign';
  end if;

  update campaigns
  set strategy = p_strategy,
      strategy_custom = true,
      updated_at = now()
  where id = p_campaign_id;
end;
$$;

grant execute on function set_campaign_strategy(text, text) to authenticated;
