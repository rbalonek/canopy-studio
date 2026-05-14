// meta-refresh-client
//
// Pulls the latest campaign performance for a single client from the Meta
// Marketing API and upserts it into the `campaigns` table.
//
// Why this is a server-side function and not a browser call:
//   1. The Meta access_token is stored in `meta_accounts.access_token` and
//      MUST NOT be exposed to the browser. We read it server-side using
//      the service_role key (bypasses RLS).
//   2. We need to assert that the caller is a member of the client's
//      workspace before touching anything. Done via the user's JWT.
//
// Auth model:
//   - Caller sends Authorization: Bearer <user JWT>.
//   - We instantiate a Supabase client with the caller's JWT (anon key +
//     user JWT) and run `auth.getUser()` to validate.
//   - We then run a workspace-membership check against the user-scoped
//     client. RLS does the heavy lifting.
//   - Once authorized, we switch to a service-role client for the
//     access_token read and the upsert (so we can bypass RLS on writes
//     and read the secret column).
//
// First-cut scope (this commit):
//   - List campaigns for the ad account.
//   - Pull MTD insights per campaign (spend, primary results, basic
//     metrics). Yesterday's insights too.
//   - Upsert into `campaigns` with last_refreshed_at = now.
//   - Return summary { refreshed: N, errors: [...], at: ts }.
//
// Out of scope (follow-up commits): ad_sets, ads, historical monthly
// data, multi-period time rollups (this_week / last_week / last_month),
// action-priority logic for non-strategy campaigns.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_API_VERSION = 'v18.0';
const META_GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

interface RefreshRequest {
  client_id: string;
  /** Optional — refresh just this location's ad account instead of every
   * location under the client. */
  location_id?: string;
}

interface RefreshResult {
  ok: boolean;
  refreshed?: number;
  errors?: string[];
  /** ad_account_ids that we actually attempted (sanitized form). */
  attempted?: string[];
  at?: string;
  error?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as RefreshRequest;
    if (!body?.client_id) {
      return json({ ok: false, error: 'client_id is required' }, 400);
    }

    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return json({ ok: false, error: 'Missing Authorization header' }, 401);
    }

    // 1. User-scoped client to validate the JWT and the workspace-member check.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ ok: false, error: 'Invalid session' }, 401);
    }

    // RLS will reject this select if the user isn't a member of the
    // client's workspace, which is exactly the gate we want.
    const { data: clientRow, error: clientErr } = await userClient
      .from('clients')
      .select('id, workspace_id')
      .eq('id', body.client_id)
      .maybeSingle();
    if (clientErr || !clientRow) {
      return json({ ok: false, error: 'Client not found or access denied' }, 403);
    }

    // 2. Service-role client to read the secret access_token and upsert.
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Token resolution: prefer the workspace-level master token; fall back
    // to the per-client meta_accounts.access_token for clients set up
    // before the workspace credentials migration.
    const accessToken = await resolveAccessToken(
      serviceClient,
      clientRow.workspace_id as string,
      body.client_id,
    );
    if (!accessToken) {
      return json(
        {
          ok: false,
          error:
            'No Meta access token configured. Set one in Settings → Connections (workspace level) or on the client\'s Ad Accounts tab.',
        },
        400,
      );
    }

    // Ad account resolution: per-location override or all locations.
    const adAccountIds = await resolveAdAccountIds(
      serviceClient,
      body.client_id,
      body.location_id ?? null,
    );
    if (adAccountIds.length === 0) {
      return json(
        {
          ok: false,
          error:
            'No Meta ad accounts configured. Add an ad account ID on a location (Clients → client → Locations) or on the client\'s Ad Accounts tab.',
        },
        400,
      );
    }

    // 3. Pull campaigns for each ad account.
    const summary = await refreshAllAdAccounts(
      body.client_id,
      adAccountIds,
      accessToken,
      serviceClient,
    );

    // Always return 200 from here; partial failures land in summary.errors
    // so the UI can show what worked and what didn't. Only 4xx/5xx for
    // setup errors (no token, no ad account, auth issues).
    return json(summary, 200);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

async function resolveAccessToken(
  service: ReturnType<typeof createClient>,
  workspaceId: string,
  clientId: string,
): Promise<string | null> {
  const { data: ws } = await service
    .from('workspace_meta_credentials')
    .select('access_token')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (ws?.access_token) return ws.access_token as string;

  const { data: legacy } = await service
    .from('meta_accounts')
    .select('access_token')
    .eq('client_id', clientId)
    .maybeSingle();
  return (legacy?.access_token as string | undefined) ?? null;
}

async function resolveAdAccountIds(
  service: ReturnType<typeof createClient>,
  clientId: string,
  locationId: string | null,
): Promise<string[]> {
  // If caller asked for a single location, only refresh that one's account.
  if (locationId) {
    const { data: loc } = await service
      .from('locations')
      .select('ad_account_id')
      .eq('id', locationId)
      .eq('client_id', clientId)
      .maybeSingle();
    const id = sanitizeAdAccountId(loc?.ad_account_id as string | null | undefined);
    return id ? [id] : [];
  }

  // Otherwise: all locations with an ad_account_id, fall back to the
  // legacy per-client meta_accounts.account_id.
  const { data: locs } = await service
    .from('locations')
    .select('ad_account_id')
    .eq('client_id', clientId)
    .not('ad_account_id', 'is', null);
  const fromLocations = (locs ?? [])
    .map((l) => sanitizeAdAccountId(l.ad_account_id as string | null))
    .filter((v): v is string => !!v);
  if (fromLocations.length > 0) return fromLocations;

  const { data: legacy } = await service
    .from('meta_accounts')
    .select('account_id')
    .eq('client_id', clientId)
    .maybeSingle();
  const legacyId = sanitizeAdAccountId(legacy?.account_id as string | null | undefined);
  return legacyId ? [legacyId] : [];
}

/** Normalize a user-entered ad account ID. Strips whitespace and ensures
 * the `act_` prefix. Returns null for empty/invalid input. */
function sanitizeAdAccountId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).replace(/\s+/g, '');
  if (!trimmed) return null;
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

async function refreshAllAdAccounts(
  clientId: string,
  adAccountIds: string[],
  accessToken: string,
  service: ReturnType<typeof createClient>,
): Promise<RefreshResult> {
  let total = 0;
  const errors: string[] = [];
  for (const id of adAccountIds) {
    const r = await refreshFromMeta(clientId, id, accessToken, service);
    if (!r.ok) {
      errors.push(`${id}: ${r.error}`);
      continue;
    }
    total += r.refreshed ?? 0;
    if (r.errors) errors.push(...r.errors);
  }
  return {
    // ok = at least one ad account refreshed cleanly, even if others errored.
    // A 0-of-N result still returns 200 from the caller (so the UI can show
    // the errors list); the boolean drives the success/error banner.
    ok: errors.length === 0,
    refreshed: total,
    errors: errors.length ? errors : undefined,
    attempted: adAccountIds,
    at: new Date().toISOString(),
  };
}

async function refreshFromMeta(
  clientId: string,
  adAccountId: string,
  accessToken: string,
  service: ReturnType<typeof createClient>,
): Promise<RefreshResult> {
  const acct = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const errors: string[] = [];

  // List campaigns for the ad account
  const campaignsUrl = new URL(`${META_GRAPH}/${acct}/campaigns`);
  campaignsUrl.searchParams.set('fields', 'id,name,status,objective');
  campaignsUrl.searchParams.set('access_token', accessToken);
  campaignsUrl.searchParams.set('limit', '100');

  const listRes = await fetch(campaignsUrl);
  if (!listRes.ok) {
    const errText = await listRes.text();
    return { ok: false, error: `Meta /campaigns failed (${listRes.status}): ${errText}` };
  }
  const listJson = await listRes.json();
  const campaigns = (listJson.data ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
  }>;

  const now = new Date().toISOString();
  const rows: any[] = [];

  for (const c of campaigns) {
    try {
      // MTD + yesterday insights for this campaign
      const [mtd, daily] = await Promise.all([
        getInsights(c.id, 'this_month', accessToken),
        getInsights(c.id, 'yesterday', accessToken),
      ]);

      const strategy = parseStrategy(c.name, c.objective);
      const mtdActions = extractPrimaryAction(mtd?.actions, strategy.expected);
      const dailyActions = extractPrimaryAction(daily?.actions, strategy.expected);

      const mtdSpend = num(mtd?.spend);
      const dailySpend = num(daily?.spend);

      rows.push({
        id: c.id,
        client_id: clientId,
        ad_account_id: acct,
        name: c.name,
        status: c.status,
        objective: c.objective,
        strategy: strategy.name,

        daily_spend: dailySpend,
        mtd_spend: mtdSpend,

        daily_results: dailyActions.count,
        daily_result_type: dailyActions.type,
        daily_cost_per_result: dailyActions.count > 0 ? dailySpend / dailyActions.count : 0,
        mtd_results: mtdActions.count,
        mtd_result_type: mtdActions.type,
        mtd_cost_per_result: mtdActions.count > 0 ? mtdSpend / mtdActions.count : 0,

        all_daily_actions: dailyActions.all,
        all_mtd_actions: mtdActions.all,

        impressions: num(mtd?.impressions),
        clicks: num(mtd?.clicks),
        cpc: num(mtd?.cpc),
        cpm: num(mtd?.cpm),
        ctr: num(mtd?.ctr),
        reach: num(mtd?.reach),
        frequency: num(mtd?.frequency),
        roas: num(mtd?.purchase_roas?.[0]?.value ?? mtd?.website_purchase_roas?.[0]?.value),

        last_refreshed_at: now,
        updated_at: now,
      });
    } catch (e) {
      errors.push(`${c.id} (${c.name}): ${(e as Error).message}`);
    }
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await service.from('campaigns').upsert(rows, { onConflict: 'id' });
    if (upsertErr) return { ok: false, error: `Upsert failed: ${upsertErr.message}` };
  }

  // For each campaign, pull ad sets, then for each ad set pull ads.
  // Per-set errors land in summary.errors so a rate limit on one node
  // doesn't abort the rest of the batch.
  for (const c of campaigns) {
    try {
      const { errors: adErrors } = await refreshAdSetsForCampaign(
        c.id,
        clientId,
        acct,
        accessToken,
        service,
      );
      if (adErrors.length) errors.push(...adErrors.map((e) => `${c.name}: ${e}`));
    } catch (e) {
      errors.push(`ad_sets for ${c.name}: ${(e as Error).message}`);
    }
  }

  return { ok: true, refreshed: rows.length, errors: errors.length ? errors : undefined, at: now };
}

async function refreshAdSetsForCampaign(
  campaignId: string,
  clientId: string,
  adAccountId: string,
  accessToken: string,
  service: ReturnType<typeof createClient>,
): Promise<{ errors: string[] }> {
  const url = new URL(`${META_GRAPH}/${campaignId}/adsets`);
  url.searchParams.set('fields', 'id,name,status,optimization_goal');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('limit', '100');

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(formatMetaError(`/adsets ${res.status}`, body));
  }
  const allAdSets = ((await res.json()).data ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    optimization_goal?: string;
  }>;

  // Skip ARCHIVED/DELETED — saves the insights calls AND keeps the
  // table aligned with the active surface area.
  const adSets = allAdSets.filter((a) => a.status !== 'ARCHIVED' && a.status !== 'DELETED');

  const now = new Date().toISOString();
  const adSetRows: Array<Record<string, unknown>> = [];

  // First pass: pull insights and collect rows. NO ads work yet.
  for (const a of adSets) {
    const [mtd, daily] = await Promise.all([
      getNodeInsights(a.id, 'this_month', accessToken),
      getNodeInsights(a.id, 'yesterday', accessToken),
    ]);
    const mtdActions = extractPrimaryAction(mtd?.actions, []);
    const dailyActions = extractPrimaryAction(daily?.actions, []);
    const mtdSpend = num(mtd?.spend);
    const dailySpend = num(daily?.spend);

    adSetRows.push({
      id: a.id,
      campaign_id: campaignId,
      client_id: clientId,
      ad_account_id: adAccountId,
      name: a.name,
      status: a.status,
      optimization_goal: a.optimization_goal ?? null,
      daily_spend: dailySpend,
      mtd_spend: mtdSpend,
      daily_results: dailyActions.count,
      daily_result_type: dailyActions.type,
      daily_cost_per_result: dailyActions.count > 0 ? dailySpend / dailyActions.count : 0,
      mtd_results: mtdActions.count,
      mtd_result_type: mtdActions.type,
      mtd_cost_per_result: mtdActions.count > 0 ? mtdSpend / mtdActions.count : 0,
      all_daily_actions: dailyActions.all,
      all_mtd_actions: mtdActions.all,
      impressions: num(mtd?.impressions),
      clicks: num(mtd?.clicks),
      cpc: num(mtd?.cpc),
      cpm: num(mtd?.cpm),
      ctr: num(mtd?.ctr),
      last_refreshed_at: now,
      updated_at: now,
    });
  }

  // Upsert ad_sets BEFORE fetching ads — the ads FK references ad_sets.id,
  // so ad_sets need to be in the DB first.
  if (adSetRows.length > 0) {
    const { error } = await service.from('ad_sets').upsert(adSetRows, { onConflict: 'id' });
    if (error) throw new Error(`ad_sets upsert: ${error.message}`);
  }

  // Second pass: ads under each ad set. Collect per-set errors instead of
  // bailing — a rate limit on one set shouldn't poison the whole batch.
  const errors: string[] = [];
  for (const a of adSets) {
    try {
      await refreshAdsForAdSet(a.id, campaignId, clientId, adAccountId, accessToken, service);
    } catch (e) {
      errors.push(`ads for ${a.id}: ${(e as Error).message}`);
    }
  }
  return { errors };
}

async function refreshAdsForAdSet(
  adSetId: string,
  campaignId: string,
  clientId: string,
  adAccountId: string,
  accessToken: string,
  service: ReturnType<typeof createClient>,
): Promise<void> {
  const url = new URL(`${META_GRAPH}/${adSetId}/ads`);
  url.searchParams.set(
    'fields',
    [
      'id',
      'name',
      'status',
      // Expand the creative object inline so we get destination URL,
      // headline, body, image/thumbnail, and call-to-action without an
      // extra round-trip per ad.
      'creative{id,image_url,thumbnail_url,object_story_spec,asset_feed_spec,call_to_action_type}',
    ].join(','),
  );
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('limit', '100');

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(formatMetaError(`/ads ${res.status}`, body));
  }
  const allAds = ((await res.json()).data ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    creative?: Record<string, any>;
  }>;

  // Skip ARCHIVED/DELETED — same reasoning as ad sets.
  const ads = allAds.filter((a) => a.status !== 'ARCHIVED' && a.status !== 'DELETED');

  const now = new Date().toISOString();
  const adRows: Array<Record<string, unknown>> = [];

  for (const a of ads) {
    const [mtd, daily] = await Promise.all([
      getNodeInsights(a.id, 'this_month', accessToken),
      getNodeInsights(a.id, 'yesterday', accessToken),
    ]);
    const mtdActions = extractPrimaryAction(mtd?.actions, []);
    const dailyActions = extractPrimaryAction(daily?.actions, []);
    const mtdSpend = num(mtd?.spend);
    const dailySpend = num(daily?.spend);

    const creative = parseCreative(a.creative);

    adRows.push({
      id: a.id,
      ad_set_id: adSetId,
      campaign_id: campaignId,
      client_id: clientId,
      ad_account_id: adAccountId,
      name: a.name,
      status: a.status,
      daily_spend: dailySpend,
      mtd_spend: mtdSpend,
      daily_results: dailyActions.count,
      daily_result_type: dailyActions.type,
      daily_cost_per_result: dailyActions.count > 0 ? dailySpend / dailyActions.count : 0,
      mtd_results: mtdActions.count,
      mtd_result_type: mtdActions.type,
      mtd_cost_per_result: mtdActions.count > 0 ? mtdSpend / mtdActions.count : 0,
      all_daily_actions: dailyActions.all,
      all_mtd_actions: mtdActions.all,
      impressions: num(mtd?.impressions),
      clicks: num(mtd?.clicks),
      cpc: num(mtd?.cpc),
      cpm: num(mtd?.cpm),
      ctr: num(mtd?.ctr),
      creative_id: creative.id,
      destination_url: creative.destination_url,
      headline: creative.headline,
      body: creative.body,
      thumbnail_url: creative.thumbnail_url,
      image_url: creative.image_url,
      call_to_action: creative.call_to_action,
      creative_raw: a.creative ?? null,
      last_refreshed_at: now,
      updated_at: now,
    });
  }

  if (adRows.length > 0) {
    const { error } = await service.from('ads').upsert(adRows, { onConflict: 'id' });
    if (error) throw new Error(`ads upsert: ${error.message}`);
  }
}

/** Pull the user-meaningful bits out of a Meta creative object — destination
 * URL, headline, body, image/thumbnail, call-to-action. Tolerant of the
 * many creative shapes (link ads, video ads, carousels, dynamic creative). */
function parseCreative(c: Record<string, any> | undefined | null): {
  id: string | null;
  destination_url: string | null;
  headline: string | null;
  body: string | null;
  thumbnail_url: string | null;
  image_url: string | null;
  call_to_action: string | null;
} {
  if (!c) {
    return {
      id: null,
      destination_url: null,
      headline: null,
      body: null,
      thumbnail_url: null,
      image_url: null,
      call_to_action: null,
    };
  }

  const oss = c.object_story_spec ?? {};
  const linkData = oss.link_data ?? null;
  const videoData = oss.video_data ?? null;
  const photoData = oss.photo_data ?? null;
  const firstChild = linkData?.child_attachments?.[0] ?? null;
  const afs = c.asset_feed_spec ?? null;

  // Destination URL: link_data.link → CTA target → carousel first child → video CTA.
  const destination_url =
    linkData?.link ??
    linkData?.call_to_action?.value?.link ??
    firstChild?.link ??
    videoData?.call_to_action?.value?.link ??
    afs?.link_urls?.[0]?.website_url ??
    null;

  // Headline: link_data.name → carousel child → video title → asset feed.
  const headline =
    linkData?.name ??
    firstChild?.name ??
    videoData?.title ??
    afs?.titles?.[0]?.text ??
    null;

  // Body: link_data.message → carousel child description → video message → asset feed.
  const body =
    linkData?.message ??
    firstChild?.description ??
    videoData?.message ??
    afs?.bodies?.[0]?.text ??
    null;

  const thumbnail_url = c.thumbnail_url ?? null;
  const image_url =
    c.image_url ??
    photoData?.image_hash ??
    afs?.images?.[0]?.url ??
    null;

  const call_to_action =
    linkData?.call_to_action?.type ??
    videoData?.call_to_action?.type ??
    c.call_to_action_type ??
    afs?.call_to_action_types?.[0] ??
    null;

  return {
    id: (c.id as string) ?? null,
    destination_url,
    headline,
    body,
    thumbnail_url,
    image_url,
    call_to_action,
  };
}

/** Format a Meta Graph API error response into something human-readable.
 * Rate-limit errors get an explicit "wait a few minutes" hint. */
function formatMetaError(prefix: string, body: string): string {
  try {
    const j = JSON.parse(body);
    const err = j.error;
    if (!err) return `${prefix}: ${body}`;
    if (err.code === 17 || err.error_subcode === 2446079) {
      return `${prefix}: Meta API rate limit reached for this ad account. Wait a few minutes and try again.`;
    }
    return `${prefix}: ${err.error_user_msg ?? err.message ?? body}`;
  } catch {
    return `${prefix}: ${body}`;
  }
}

async function getNodeInsights(
  nodeId: string,
  datePreset: string,
  accessToken: string,
): Promise<Record<string, any> | null> {
  const url = new URL(`${META_GRAPH}/${nodeId}/insights`);
  url.searchParams.set(
    'fields',
    ['spend', 'impressions', 'clicks', 'actions', 'cpc', 'cpm', 'ctr'].join(','),
  );
  url.searchParams.set('date_preset', datePreset);
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url);
  if (!res.ok) return null; // tolerate per-node failures so one bad ad doesn't kill the batch
  const j = await res.json();
  return (j.data?.[0] ?? null) as Record<string, any> | null;
}

async function getInsights(campaignId: string, datePreset: string, accessToken: string) {
  const url = new URL(`${META_GRAPH}/${campaignId}/insights`);
  url.searchParams.set(
    'fields',
    [
      'spend',
      'impressions',
      'clicks',
      'actions',
      'cpc',
      'cpm',
      'ctr',
      'reach',
      'frequency',
      'purchase_roas',
      'website_purchase_roas',
    ].join(','),
  );
  url.searchParams.set('date_preset', datePreset);
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`/insights ${datePreset} ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.data?.[0] ?? null) as Record<string, any> | null;
}

function parseStrategy(name: string, objective: string): { name: string; expected: string[] } {
  const n = name.toLowerCase();
  if (n.includes('lead'))
    return { name: 'Lead Generation', expected: ['offsite_conversion.fb_pixel_lead', 'lead'] };
  if (n.includes('add to cart') || n.includes('atc'))
    return {
      name: 'Add to Cart (Warm-up)',
      expected: ['offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart', 'onsite_web_add_to_cart'],
    };
  if (n.includes('view content') || n.includes('vc'))
    return {
      name: 'View Content (Warm-up)',
      expected: ['offsite_conversion.fb_pixel_view_content', 'view_content'],
    };
  if (n.includes('traffic'))
    return { name: 'Traffic (Warm-up)', expected: ['landing_page_view', 'link_click'] };
  if (n.includes('video view')) return { name: 'Video Views (Warm-up)', expected: ['video_view'] };
  if (n.includes('purchase') || n.includes('sales') || n.includes('conversion'))
    return { name: 'Purchase', expected: ['offsite_conversion.fb_pixel_purchase', 'purchase'] };
  if (objective === 'OUTCOME_LEADS' || objective === 'LEAD_GENERATION')
    return { name: 'Lead Generation', expected: ['offsite_conversion.fb_pixel_lead', 'lead'] };
  if (objective === 'OUTCOME_SALES')
    return { name: 'Sales', expected: ['offsite_conversion.fb_pixel_purchase', 'purchase'] };
  if (objective === 'OUTCOME_AWARENESS')
    return { name: 'Awareness', expected: ['video_view', 'post_engagement', 'page_engagement'] };
  if (objective === 'OUTCOME_TRAFFIC')
    return { name: 'Traffic', expected: ['landing_page_view', 'link_click'] };
  return { name: 'Unknown', expected: [] };
}

function extractPrimaryAction(
  actions: Array<{ action_type: string; value: string }> | undefined | null,
  expected: string[],
): { type: string | null; count: number; all: Record<string, number> } {
  if (!actions || !Array.isArray(actions)) return { type: null, count: 0, all: {} };
  const all: Record<string, number> = {};
  for (const a of actions) all[a.action_type] = num(a.value);

  for (const t of expected) {
    if (all[t] > 0) return { type: t, count: all[t], all };
  }
  const priority = [
    'offsite_conversion.fb_pixel_purchase',
    'purchase',
    'offsite_conversion.fb_pixel_lead',
    'lead',
    'offsite_conversion.fb_pixel_add_to_cart',
    'add_to_cart',
    'offsite_conversion.fb_pixel_initiate_checkout',
    'initiate_checkout',
    'offsite_conversion.fb_pixel_view_content',
    'view_content',
    'landing_page_view',
    'link_click',
    'post_engagement',
    'video_view',
    'page_engagement',
  ];
  for (const t of priority) {
    if (all[t] > 0) return { type: t, count: all[t], all };
  }
  return { type: null, count: 0, all };
}

function num(v: any): number {
  if (v === undefined || v === null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
