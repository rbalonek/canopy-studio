// google-ads-refresh
//
// Pulls Google Ads campaigns + metrics for one client into the SAME tables
// Meta uses (`campaigns`, `campaign_metrics_daily`) with platform='google'
// and ids prefixed `gads_<campaign_id>` so text PKs never collide with
// Meta's. Mirrors meta-refresh-client's shape and its hard-won rules:
// account-level GAQL queries only (one searchStream per period, never
// per-campaign), and an idempotent month-chunked daily backfill.
//
// Request body: { client_id, customer_id?, backfill?: { since, until } }
//   customer_id — scope to one Google Ads account (digits only); omitted =
//     every account configured on the client/locations.
//   backfill    — history-only path: per-day rows into
//     campaign_metrics_daily, snapshot untouched.
//
// Credentials: workspace_google_credentials (OAuth refresh token +
// login_customer_id MCC). Secrets: GOOGLE_ADS_DEVELOPER_TOKEN,
// GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS, json } from '../_shared/cors.ts';
import { isInternalCall } from '../_shared/internal.ts';

const ADS_API = 'https://googleads.googleapis.com/v18';

interface RefreshRequest {
  client_id: string;
  customer_id?: string;
  backfill?: { since: string; until: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as RefreshRequest;
    if (!body?.client_id) return json({ ok: false, error: 'client_id is required' }, 400);

    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Authorize: internal automation via the shared secret, browsers via
    // their JWT + RLS membership (the select fails for non-members).
    type ClientRow = { id: string; workspace_id: string; google_customer_id: string | null };
    let clientRow: ClientRow | null = null;
    if (isInternalCall(req)) {
      const { data } = await service
        .from('clients')
        .select('id, workspace_id, google_customer_id')
        .eq('id', body.client_id)
        .maybeSingle();
      clientRow = data as ClientRow | null;
    } else {
      const auth = req.headers.get('Authorization');
      if (!auth?.startsWith('Bearer ')) {
        return json({ ok: false, error: 'Missing Authorization header' }, 401);
      }
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: auth } } },
      );
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return json({ ok: false, error: 'Invalid session' }, 401);
      const { data } = await userClient
        .from('clients')
        .select('id, workspace_id, google_customer_id')
        .eq('id', body.client_id)
        .maybeSingle();
      clientRow = data as ClientRow | null;
    }
    if (!clientRow) return json({ ok: false, error: 'Client not found or access denied' }, 404);

    // Which customer ids to pull: explicit (validated), else client-level +
    // per-location ids.
    const { data: locs } = await service
      .from('locations')
      .select('google_customer_id')
      .eq('client_id', clientRow.id)
      .not('google_customer_id', 'is', null);
    const configured = new Set<string>();
    if (clientRow.google_customer_id) configured.add(normalizeCid(clientRow.google_customer_id));
    for (const l of (locs ?? []) as any[]) configured.add(normalizeCid(l.google_customer_id));
    if (configured.size === 0) {
      return json({ ok: false, error: 'No Google Ads customer id configured for this client.' }, 400);
    }
    let customerIds = Array.from(configured);
    if (body.customer_id) {
      const want = normalizeCid(body.customer_id);
      if (!configured.has(want)) {
        return json({ ok: false, error: 'customer_id is not configured on this client.' }, 400);
      }
      customerIds = [want];
    }

    // Credentials: workspace refresh token → short-lived access token.
    const { data: creds } = await service
      .from('workspace_google_credentials')
      .select('refresh_token, login_customer_id')
      .eq('workspace_id', clientRow.workspace_id)
      .maybeSingle();
    if (!creds?.refresh_token) {
      return json(
        { ok: false, error: 'Google Ads is not connected — connect it in Settings → Connections.' },
        400,
      );
    }
    const devToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
    if (!devToken) {
      return json({ ok: false, error: 'GOOGLE_ADS_DEVELOPER_TOKEN is not configured.' }, 400);
    }
    const accessToken = await mintAccessToken(creds.refresh_token as string);
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': devToken,
      ...(creds.login_customer_id
        ? { 'login-customer-id': normalizeCid(creds.login_customer_id as string) }
        : {}),
      'Content-Type': 'application/json',
    };

    if (body.backfill) {
      const result = await backfillDaily(service, clientRow.id, customerIds, headers, body.backfill);
      return json({ ok: true, mode: 'backfill', ...result });
    }

    const result = await snapshot(service, clientRow.id, customerIds, headers);
    return json({ ok: true, mode: 'snapshot', ...result });
  } catch (e) {
    console.error('[google-ads-refresh]', e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

function normalizeCid(cid: string): string {
  return cid.replace(/[^0-9]/g, '');
}

async function mintAccessToken(refreshToken: string): Promise<string> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = (await resp.json()) as any;
  if (!resp.ok || !data.access_token) {
    throw new Error(`Google token refresh failed: ${data?.error_description ?? data?.error ?? resp.status}`);
  }
  return data.access_token as string;
}

/** One account-level searchStream call; returns flattened result rows. */
async function gaql(customerId: string, headers: Record<string, string>, query: string): Promise<any[]> {
  const resp = await fetch(`${ADS_API}/customers/${customerId}/googleAds:searchStream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });
  const data = (await resp.json()) as any;
  if (!resp.ok) {
    const detail =
      data?.[0]?.error?.message ?? data?.error?.message ?? JSON.stringify(data).slice(0, 300);
    throw new Error(`Google Ads query failed (${resp.status}): ${detail}`);
  }
  const chunks = Array.isArray(data) ? data : [data];
  return chunks.flatMap((c: any) => c.results ?? []);
}

const CAMPAIGN_FIELDS = `
  campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
  metrics.cost_micros, metrics.impressions, metrics.clicks,
  metrics.conversions, metrics.conversions_value, metrics.average_cpc, metrics.ctr`;

/** Compress one GAQL campaign row into the same per-period shape Meta's
 * periodMetrics produces, so metrics_by_period is platform-uniform. */
function periodMetrics(row: any): Record<string, any> {
  const m = row?.metrics ?? {};
  const spend = Number(m.costMicros ?? 0) / 1e6;
  const impressions = Number(m.impressions ?? 0);
  const clicks = Number(m.clicks ?? 0);
  const conversions = Number(m.conversions ?? 0);
  const revenue = Number(m.conversionsValue ?? 0);
  return {
    spend,
    impressions,
    clicks,
    cpc: Number(m.averageCpc ?? 0) / 1e6,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    ctr: Number(m.ctr ?? 0) * 100,
    reach: 0,
    frequency: 0,
    roas: spend > 0 ? revenue / spend : 0,
    date_start: null,
    date_stop: null,
    actions: { conversions, conversions_value: revenue },
  };
}

function mapStatus(status: string | undefined): string {
  if (status === 'ENABLED') return 'ACTIVE';
  if (status === 'REMOVED') return 'DELETED';
  return status ?? 'UNKNOWN';
}

async function snapshot(
  service: any,
  clientId: string,
  customerIds: string[],
  headers: Record<string, string>,
): Promise<{ campaigns: number; accounts: number }> {
  const now = new Date().toISOString();
  let total = 0;

  for (const cid of customerIds) {
    // Three account-level calls — one per period, never per-campaign.
    const periods: Array<[string, string]> = [
      ['this_month', 'THIS_MONTH'],
      ['last_month', 'LAST_MONTH'],
      ['last_30d', 'LAST_30_DAYS'],
    ];
    const byPeriod = new Map<string, Map<string, any>>();
    for (const [key, during] of periods) {
      const rows = await gaql(
        cid,
        headers,
        `SELECT ${CAMPAIGN_FIELDS} FROM campaign WHERE segments.date DURING ${during}`,
      );
      const map = new Map<string, any>();
      for (const r of rows) map.set(String(r.campaign.id), r);
      byPeriod.set(key, map);
    }
    // Campaign identity (status/name) independent of date windows, so
    // campaigns with zero recent traffic still sync.
    const identity = await gaql(
      cid,
      headers,
      'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign',
    );

    const upserts = identity.map((r: any) => {
      const gid = String(r.campaign.id);
      const mtd = byPeriod.get('this_month')!.get(gid);
      const mtdM = periodMetrics(mtd);
      return {
        id: `gads_${gid}`,
        client_id: clientId,
        ad_account_id: cid,
        platform: 'google',
        name: r.campaign.name ?? gid,
        status: mapStatus(r.campaign.status),
        objective: r.campaign.advertisingChannelType ?? null,
        mtd_spend: mtdM.spend,
        mtd_results: mtdM.actions.conversions,
        mtd_result_type: 'conversions',
        mtd_cost_per_result:
          mtdM.actions.conversions > 0 ? mtdM.spend / mtdM.actions.conversions : 0,
        all_mtd_actions: mtdM.actions,
        impressions: mtdM.impressions,
        clicks: mtdM.clicks,
        cpc: mtdM.cpc,
        cpm: mtdM.cpm,
        ctr: mtdM.ctr,
        roas: mtdM.roas,
        metrics_by_period: {
          this_month: mtdM,
          last_month: periodMetrics(byPeriod.get('last_month')!.get(gid)),
          last_30d: periodMetrics(byPeriod.get('last_30d')!.get(gid)),
        },
        last_refreshed_at: now,
        updated_at: now,
      };
    });

    if (upserts.length) {
      // Preserve user-set strategy the same way the Meta refresh does:
      // strategy is only written on insert (null), never clobbered here.
      const { error } = await service
        .from('campaigns')
        .upsert(upserts, { onConflict: 'id' });
      if (error) throw new Error(`campaigns upsert failed: ${error.message}`);
      total += upserts.length;
    }
  }
  return { campaigns: total, accounts: customerIds.length };
}

/** History-only path: per-day campaign rows between since/until, chunked
 * by calendar month so each account-level call stays small. Idempotent via
 * unique(campaign_id, date). Day rows for campaigns that no longer exist
 * in `campaigns` are skipped (FK) and counted, same as the Meta backfill. */
async function backfillDaily(
  service: any,
  clientId: string,
  customerIds: string[],
  headers: Record<string, string>,
  range: { since: string; until: string },
): Promise<{ days_upserted: number; skipped_missing_campaigns: number }> {
  const { data: existing } = await service.from('campaigns').select('id').eq('client_id', clientId);
  const known = new Set(((existing ?? []) as any[]).map((r) => r.id as string));

  let upserted = 0;
  let skipped = 0;
  for (const cid of customerIds) {
    for (const [start, end] of monthChunks(range.since, range.until)) {
      const rows = await gaql(
        cid,
        headers,
        `SELECT segments.date, ${CAMPAIGN_FIELDS} FROM campaign WHERE segments.date BETWEEN '${start}' AND '${end}'`,
      );
      const dayRows = rows
        .map((r: any) => {
          const m = periodMetrics(r);
          return {
            campaign_id: `gads_${r.campaign.id}`,
            client_id: clientId,
            date: r.segments.date,
            platform: 'google',
            spend: m.spend,
            impressions: m.impressions,
            clicks: m.clicks,
            results: m.actions.conversions,
            result_type: 'conversions',
            metrics: { revenue: m.actions.conversions_value, roas: m.roas, cpc: m.cpc, ctr: m.ctr },
          };
        })
        .filter((r: any) => {
          if (known.has(r.campaign_id)) return true;
          skipped++;
          return false;
        });
      if (dayRows.length) {
        const { error } = await service
          .from('campaign_metrics_daily')
          .upsert(dayRows, { onConflict: 'campaign_id,date' });
        if (error) throw new Error(`daily upsert failed: ${error.message}`);
        upserted += dayRows.length;
      }
    }
  }
  return { days_upserted: upserted, skipped_missing_campaigns: skipped };
}

/** [start, end] pairs covering since→until, split on calendar months. */
function monthChunks(since: string, until: string): Array<[string, string]> {
  const chunks: Array<[string, string]> = [];
  let cur = new Date(`${since}T00:00:00Z`);
  const stop = new Date(`${until}T00:00:00Z`);
  while (cur <= stop) {
    const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
    const end = monthEnd < stop ? monthEnd : stop;
    chunks.push([cur.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]);
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
  }
  return chunks;
}
