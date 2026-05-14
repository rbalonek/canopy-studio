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
}

interface RefreshResult {
  ok: boolean;
  refreshed?: number;
  errors?: string[];
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

    // Ad account resolution: prefer per-location ad_account_id values
    // (multi-location agencies). Fall back to the single
    // meta_accounts.account_id for clients that haven't split out
    // locations yet.
    const adAccountIds = await resolveAdAccountIds(serviceClient, body.client_id);
    if (adAccountIds.length === 0) {
      return json(
        {
          ok: false,
          error:
            'No Meta ad accounts configured for this client. Add ad_account_id on each location, or set one on the client\'s Ad Accounts tab.',
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

    return json(summary, summary.ok ? 200 : 502);
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
): Promise<string[]> {
  const { data: locs } = await service
    .from('locations')
    .select('ad_account_id')
    .eq('client_id', clientId)
    .not('ad_account_id', 'is', null);
  const fromLocations = (locs ?? [])
    .map((l) => (l.ad_account_id as string | null) ?? '')
    .filter(Boolean);
  if (fromLocations.length > 0) return fromLocations;

  const { data: legacy } = await service
    .from('meta_accounts')
    .select('account_id')
    .eq('client_id', clientId)
    .maybeSingle();
  return legacy?.account_id ? [legacy.account_id as string] : [];
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
    ok: errors.length === 0 || total > 0,
    refreshed: total,
    errors: errors.length ? errors : undefined,
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

  return { ok: true, refreshed: rows.length, errors: errors.length ? errors : undefined, at: now };
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
