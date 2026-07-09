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
import { isInternalCall } from '../_shared/internal.ts';

const META_API_VERSION = 'v18.0';
const META_GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

interface RefreshRequest {
  client_id: string;
  /** Optional — refresh just this location's ad account instead of every
   * location under the client. */
  location_id?: string;
  /** Optional — refresh only this specific ad account (must be one of the
   * client's configured accounts). Narrows the refresh to the single account
   * the user acted on instead of fanning out over all of them. */
  ad_account_id?: string;
  /** Optional — historical backfill. When present, the function does NOT refresh
   * the current `campaigns` snapshot; it pulls per-day campaign insights for the
   * range (time_range + time_increment=1) and upserts them into
   * `campaign_metrics_daily`. Idempotent via unique(campaign_id, date), so the
   * user can pull past periods (e.g. this year / last year) without a full
   * account refresh and without clobbering today's numbers. */
  backfill?: { since?: string; until?: string };
}

interface RefreshResult {
  ok: boolean;
  refreshed?: number;
  /** Backfill only: per-day rows skipped because their campaign no longer
   * exists in the table (deleted campaigns referenced by historical insights). */
  skipped?: number;
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

    // Service-role client (secret access_token read + upserts).
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Authorize. Two callers: browsers (user JWT + RLS membership
    // gate) and internal automation — cron-dispatch — via the shared
    // secret, which has no user context and skips the member check.
    type ClientRow = { id: string; workspace_id: string };
    let clientRow: ClientRow | null = null;
    if (isInternalCall(req)) {
      const { data } = await serviceClient
        .from('clients')
        .select('id, workspace_id')
        .eq('id', body.client_id)
        .maybeSingle();
      clientRow = data as ClientRow | null;
      if (!clientRow) return json({ ok: false, error: 'Client not found' }, 404);
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
      if (userErr || !userData.user) {
        return json({ ok: false, error: 'Invalid session' }, 401);
      }

      // RLS will reject this select if the user isn't a member of the
      // client's workspace, which is exactly the gate we want.
      const { data, error: clientErr } = await userClient
        .from('clients')
        .select('id, workspace_id')
        .eq('id', body.client_id)
        .maybeSingle();
      if (clientErr || !data) {
        return json({ ok: false, error: 'Client not found or access denied' }, 403);
      }
      clientRow = data as ClientRow | null;
    }
    if (!clientRow) return json({ ok: false, error: 'Client not found' }, 404);

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

    // If the caller named a specific ad account, refresh only that one — but
    // only if it's actually one of this client's configured accounts (so a
    // member can't refresh an arbitrary account through this endpoint).
    let targetAccounts = adAccountIds;
    if (body.ad_account_id) {
      const want = sanitizeAdAccountId(body.ad_account_id);
      targetAccounts = adAccountIds.filter((id) => id === want);
      if (targetAccounts.length === 0) {
        return json(
          { ok: false, error: 'That ad account is not configured for this client.' },
          400,
        );
      }
    }

    // 2b. Historical backfill path — pull per-day insights into
    // campaign_metrics_daily for the requested range and return, without
    // touching the current campaigns snapshot.
    if (body.backfill) {
      const { since, until } = normalizeBackfillRange(body.backfill);
      if (!since || !until) {
        return json(
          { ok: false, error: 'backfill.since and backfill.until must be YYYY-MM-DD dates.' },
          400,
        );
      }
      const backfillSummary = await backfillAllAdAccounts(
        body.client_id,
        targetAccounts,
        accessToken,
        since,
        until,
        serviceClient,
      );
      return json(backfillSummary, 200);
    }

    // 3. Pull campaigns for each targeted ad account.
    const summary = await refreshAllAdAccounts(
      body.client_id,
      targetAccounts,
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
  // A per-client app override (e.g. a client testing under a different
  // Meta app) beats the workspace master token.
  const { data: clientCreds } = await service
    .from('client_meta_credentials')
    .select('access_token')
    .eq('client_id', clientId)
    .maybeSingle();
  if (clientCreds?.access_token) return clientCreds.access_token as string;

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
  const fromLocations = ((locs ?? []) as any[])
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** True for Meta responses that mean "you're calling too fast" — code 4/17/32/
 * 613 or the various rate-limit subcodes/messages. */
function isRateLimit(status: number, body: string): boolean {
  if (![400, 429, 403, 500].includes(status)) return false;
  try {
    const err = JSON.parse(body).error;
    if (!err) return /rate limit|request limit|too many/i.test(body);
    if ([4, 17, 32, 613, 80000, 80004].includes(err.code)) return true;
    if ([2446079, 1487742].includes(err.error_subcode)) return true;
    return /rate limit|request limit|reduce the amount|too many/i.test(err.message ?? '');
  } catch {
    return /rate limit|request limit|too many/i.test(body);
  }
}

/** fetch() with a short backoff+retry on Meta rate-limit responses. Kept brief
 * (few calls now that everything is account-level) so a full refresh still fits
 * the Edge Function wall-clock budget. */
async function metaFetch(url: string): Promise<Response> {
  const MAX = 3;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url);
    if (res.ok || attempt >= MAX) return res;
    const body = await res.clone().text().catch(() => '');
    if (!isRateLimit(res.status, body)) return res;
    await sleep(4000 * (attempt + 1));
  }
}

/** Follow Meta paging.next across all pages of an edge, returning the flattened
 * `data` rows. Throws a formatted error (incl. the rate-limit hint) on failure. */
// deno-lint-ignore no-explicit-any
async function fetchAllPages(url: URL, label: string, maxPages = 25): Promise<any[]> {
  // deno-lint-ignore no-explicit-any
  const out: any[] = [];
  let next: string | null = url.toString();
  let guard = 0;
  while (next && guard < maxPages) {
    guard++;
    const res = await metaFetch(next);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(formatMetaError(`${label} ${res.status}`, body));
    }
    const j = await res.json();
    for (const row of j.data ?? []) out.push(row);
    next = (j.paging?.next as string | undefined) ?? null;
  }
  return out;
}

/** ONE account-level insights call per (level, preset), keyed by node id.
 * Replaces the previous per-node /insights fan-out that tripped Meta's
 * per-account rate limit on larger accounts. */
async function getAccountInsights(
  acct: string,
  level: 'campaign' | 'adset' | 'ad',
  datePreset: string,
  fields: string,
  accessToken: string,
  // deno-lint-ignore no-explicit-any
): Promise<Map<string, Record<string, any>>> {
  const idField = level === 'campaign' ? 'campaign_id' : level === 'adset' ? 'adset_id' : 'ad_id';
  const url = new URL(`${META_GRAPH}/${acct}/insights`);
  url.searchParams.set('level', level);
  url.searchParams.set('fields', `${idField},${fields},date_start`);
  url.searchParams.set('date_preset', datePreset);
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', accessToken);
  const rows = await fetchAllPages(url, `/insights ${level}`);
  // deno-lint-ignore no-explicit-any
  const map = new Map<string, Record<string, any>>();
  for (const r of rows) {
    const id = r[idField] as string | undefined;
    if (id) map.set(id, r);
  }
  return map;
}

/** Compress one insights row into a compact per-period object — all the
 * standard fields plus the raw { action_type: count } map. Stored on
 * campaigns.metrics_by_period so the UI can switch periods and the analysis
 * bots have every metric per period, not just the current month. */
// deno-lint-ignore no-explicit-any
function periodMetrics(row: Record<string, any> | null | undefined): Record<string, any> {
  const actions: Record<string, number> = {};
  // deno-lint-ignore no-explicit-any
  for (const a of (row?.actions ?? []) as any[]) actions[a.action_type] = num(a.value);
  return {
    spend: num(row?.spend),
    impressions: num(row?.impressions),
    clicks: num(row?.clicks),
    cpc: num(row?.cpc),
    cpm: num(row?.cpm),
    ctr: num(row?.ctr),
    reach: num(row?.reach),
    frequency: num(row?.frequency),
    roas: num(row?.purchase_roas?.[0]?.value ?? row?.website_purchase_roas?.[0]?.value),
    date_start: (row?.date_start as string | undefined) ?? null,
    date_stop: (row?.date_stop as string | undefined) ?? null,
    actions,
  };
}

// --- Historical backfill --------------------------------------------------

/** Purchase conversion value action types, richest-first. Used to derive
 * revenue (which is additive across days, unlike ROAS). */
const PURCHASE_VALUE_TYPES = [
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'purchase',
  'onsite_web_purchase',
];

/** First present (>0) value among candidate action types in an action_values
 * array (Meta's monetary counterpart to `actions`). */
// deno-lint-ignore no-explicit-any
function pickActionValue(values: any[] | undefined | null, types: string[]): number {
  if (!Array.isArray(values)) return 0;
  const map: Record<string, number> = {};
  for (const v of values) map[v.action_type] = num(v.value);
  for (const t of types) if (map[t] > 0) return map[t];
  return 0;
}

/** Validate a YYYY-MM-DD string. */
function isoDate(s: unknown): string | null {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Sanitize the requested backfill window: valid ISO dates, since ≤ until,
 * until ≤ today, and since floored to Meta's ~37-month insights retention. */
function normalizeBackfillRange(b: { since?: string; until?: string }): {
  since: string | null;
  until: string | null;
} {
  let since = isoDate(b?.since);
  let until = isoDate(b?.until);
  if (!since || !until) return { since: null, until: null };
  if (since > until) [since, until] = [until, since];
  const today = new Date().toISOString().slice(0, 10);
  if (until > today) until = today;
  const floor = new Date(Date.now() - 37 * 30 * 86_400_000).toISOString().slice(0, 10);
  if (since < floor) since = floor;
  return { since, until };
}

/** Split an inclusive [since, until] window into calendar-month chunks. Keeps
 * each per-day insights call small (campaigns × ≤31 rows) — well within Meta's
 * sync-insights payload limit and our page guard — instead of one massive
 * time_range spanning a year. */
function monthChunks(since: string, until: string): { since: string; until: string }[] {
  const out: { since: string; until: string }[] = [];
  let cursor = since;
  let guard = 0;
  while (cursor <= until && guard < 60) {
    guard++;
    const yy = parseInt(cursor.slice(0, 4), 10);
    const mm = parseInt(cursor.slice(5, 7), 10);
    const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    const monthEnd = `${yy}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    out.push({ since: cursor, until: monthEnd < until ? monthEnd : until });
    const nextY = mm === 12 ? yy + 1 : yy;
    const nextM = mm === 12 ? 1 : mm + 1;
    cursor = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  }
  return out;
}

/** One account-level per-day insights call for a date window (time_range +
 * time_increment=1). Returns the raw rows — each carries `${idField}` +
 * `date_start` (the day). Higher page guard than the preset path: a month of
 * daily rows for a large account can exceed 25 pages. */
async function fetchRangeInsights(
  acct: string,
  level: 'campaign' | 'adset' | 'ad',
  since: string,
  until: string,
  fields: string,
  accessToken: string,
  // deno-lint-ignore no-explicit-any
): Promise<any[]> {
  const idField = level === 'campaign' ? 'campaign_id' : level === 'adset' ? 'adset_id' : 'ad_id';
  const url = new URL(`${META_GRAPH}/${acct}/insights`);
  url.searchParams.set('level', level);
  url.searchParams.set('fields', `${idField},${fields},date_start`);
  url.searchParams.set('time_range', JSON.stringify({ since, until }));
  url.searchParams.set('time_increment', '1');
  url.searchParams.set('limit', '500');
  url.searchParams.set('access_token', accessToken);
  return await fetchAllPages(url, `/insights ${level} ${since}..${until}`, 120);
}

/** Backfill campaign_metrics_daily for one ad account over [since, until].
 * Does NOT touch the campaigns snapshot — history only. */
async function backfillFromMeta(
  clientId: string,
  adAccountId: string,
  accessToken: string,
  since: string,
  until: string,
  service: ReturnType<typeof createClient>,
): Promise<{ ok: boolean; days: number; skipped: number; error?: string; errors?: string[] }> {
  const acct = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const errors: string[] = [];

  // Campaign names/objectives → strategy, so per-day `results` matches the
  // primary-action logic the nightly refresh uses.
  const campaignsUrl = new URL(`${META_GRAPH}/${acct}/campaigns`);
  campaignsUrl.searchParams.set('fields', 'id,name,objective');
  campaignsUrl.searchParams.set('access_token', accessToken);
  campaignsUrl.searchParams.set('limit', '200');
  let campaigns: Array<{ id: string; name: string; objective: string }> = [];
  try {
    campaigns = (await fetchAllPages(campaignsUrl, '/campaigns')) as any;
  } catch (e) {
    return { ok: false, days: 0, error: `Meta /campaigns failed: ${(e as Error).message}` };
  }
  const stratById = new Map<string, { name: string; expected: string[] }>();
  for (const c of campaigns) stratById.set(c.id, parseStrategy(c.name, c.objective));

  const FIELDS =
    'spend,impressions,clicks,actions,action_values,cpc,cpm,ctr,reach,frequency,purchase_roas,website_purchase_roas';

  const metricRows: any[] = [];
  for (const chunk of monthChunks(since, until)) {
    let rows: any[];
    try {
      rows = await fetchRangeInsights(acct, 'campaign', chunk.since, chunk.until, FIELDS, accessToken);
    } catch (e) {
      errors.push(`${chunk.since}..${chunk.until}: ${(e as Error).message}`);
      continue;
    }
    for (const r of rows) {
      const cid = r.campaign_id as string | undefined;
      const date = r.date_start as string | undefined;
      if (!cid || !date) continue;
      const strat = stratById.get(cid) ?? { name: 'Unknown', expected: [] };
      const act = extractPrimaryAction(r.actions, strat.expected);
      const spend = num(r.spend);
      const revenue = pickActionValue(r.action_values, PURCHASE_VALUE_TYPES);
      const roas =
        num(r.purchase_roas?.[0]?.value ?? r.website_purchase_roas?.[0]?.value) ||
        (spend > 0 ? revenue / spend : 0);
      metricRows.push({
        campaign_id: cid,
        client_id: clientId,
        date,
        spend,
        impressions: num(r.impressions),
        clicks: num(r.clicks),
        results: act.count,
        result_type: act.type,
        metrics: {
          cpc: num(r.cpc),
          cpm: num(r.cpm),
          ctr: num(r.ctr),
          all_actions: act.all,
          revenue,
          roas,
        },
      });
    }
  }

  // The FK campaign_metrics_daily.campaign_id → campaigns.id means we can only
  // write history for campaigns that exist in the table. Historical insights
  // routinely reference campaigns that were since DELETED (they're absent from
  // the current /campaigns list and the table), so filter those out — otherwise
  // one orphan id aborts the whole 500-row batch. Skipped rows are reported, not
  // swallowed, so a lower historical total is explainable.
  const { data: known } = await service
    .from('campaigns')
    .select('id')
    .eq('ad_account_id', acct);
  const knownIds = new Set((known ?? []).map((r: any) => r.id as string));
  const insertable = metricRows.filter((r) => knownIds.has(r.campaign_id));
  const skipped = metricRows.length - insertable.length;

  let days = 0;
  const BATCH = 500;
  for (let i = 0; i < insertable.length; i += BATCH) {
    const slice = insertable.slice(i, i + BATCH);
    const { error } = await service
      .from('campaign_metrics_daily')
      .upsert(slice, { onConflict: 'campaign_id,date' });
    if (error) errors.push(`daily upsert: ${error.message}`);
    else days += slice.length;
  }

  return { ok: errors.length === 0, days, skipped, errors: errors.length ? errors : undefined };
}

async function backfillAllAdAccounts(
  clientId: string,
  adAccountIds: string[],
  accessToken: string,
  since: string,
  until: string,
  service: ReturnType<typeof createClient>,
): Promise<RefreshResult> {
  let total = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const id of adAccountIds) {
    const r = await backfillFromMeta(clientId, id, accessToken, since, until, service);
    if (!r.ok && r.error) {
      errors.push(`${id}: ${r.error}`);
      continue;
    }
    total += r.days ?? 0;
    skipped += r.skipped ?? 0;
    if (r.errors) errors.push(...r.errors);
  }
  return {
    ok: errors.length === 0,
    // `refreshed` here = per-day campaign rows written to history.
    refreshed: total,
    skipped: skipped || undefined,
    errors: errors.length ? errors : undefined,
    attempted: adAccountIds,
    at: new Date().toISOString(),
  };
}

/** Ad sets + ads for the whole account in a handful of batched calls: one list
 * call per level (paginated) and two account-level insights calls per level —
 * NOT one /adsets call per campaign and one /ads call per ad set (that fan-out
 * is what Meta rate-limited). Preserves FK ordering: ad_sets before ads. */
async function refreshAdSetsAndAds(
  acct: string,
  clientId: string,
  campaignIds: Set<string>,
  accessToken: string,
  service: ReturnType<typeof createClient>,
): Promise<string[]> {
  const errors: string[] = [];
  const now = new Date().toISOString();
  const NODE_FIELDS = 'spend,impressions,clicks,actions,cpc,cpm,ctr';

  // --- Ad sets: one list call + two insights calls ---
  const adsetsUrl = new URL(`${META_GRAPH}/${acct}/adsets`);
  adsetsUrl.searchParams.set('fields', 'id,name,status,optimization_goal,campaign_id');
  adsetsUrl.searchParams.set('access_token', accessToken);
  adsetsUrl.searchParams.set('limit', '500');
  const allAdSets = await fetchAllPages(adsetsUrl, '/adsets');
  const adSets = allAdSets.filter(
    (a) => a.status !== 'ARCHIVED' && a.status !== 'DELETED' && campaignIds.has(a.campaign_id),
  );

  const [asMtd, asDaily] = await Promise.all([
    getAccountInsights(acct, 'adset', 'this_month', NODE_FIELDS, accessToken),
    getAccountInsights(acct, 'adset', 'yesterday', NODE_FIELDS, accessToken),
  ]);

  const adSetIds = new Set<string>();
  const adSetRows = adSets.map((a) => {
    adSetIds.add(a.id);
    const mtd = asMtd.get(a.id) ?? null;
    const daily = asDaily.get(a.id) ?? null;
    const mtdActions = extractPrimaryAction(mtd?.actions, []);
    const dailyActions = extractPrimaryAction(daily?.actions, []);
    const mtdSpend = num(mtd?.spend);
    const dailySpend = num(daily?.spend);
    return {
      id: a.id,
      campaign_id: a.campaign_id,
      client_id: clientId,
      ad_account_id: acct,
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
    };
  });

  if (adSetRows.length > 0) {
    const { error } = await service.from('ad_sets').upsert(adSetRows, { onConflict: 'id' });
    if (error) {
      // ads FK-reference ad_sets, so a failed ad_sets write means we must not
      // attempt the ads write.
      errors.push(`ad_sets upsert: ${error.message}`);
      return errors;
    }
  }

  // --- Ads: one list call (creative expanded inline) + two insights calls ---
  const adsUrl = new URL(`${META_GRAPH}/${acct}/ads`);
  adsUrl.searchParams.set(
    'fields',
    'id,name,status,adset_id,campaign_id,creative{id,image_url,thumbnail_url,object_story_spec,asset_feed_spec,call_to_action_type}',
  );
  adsUrl.searchParams.set('access_token', accessToken);
  adsUrl.searchParams.set('limit', '300');
  const allAds = await fetchAllPages(adsUrl, '/ads');
  const ads = allAds.filter(
    (a) => a.status !== 'ARCHIVED' && a.status !== 'DELETED' && adSetIds.has(a.adset_id),
  );

  const [adMtd, adDaily] = await Promise.all([
    getAccountInsights(acct, 'ad', 'this_month', NODE_FIELDS, accessToken),
    getAccountInsights(acct, 'ad', 'yesterday', NODE_FIELDS, accessToken),
  ]);

  const adRows = ads.map((a) => {
    const mtd = adMtd.get(a.id) ?? null;
    const daily = adDaily.get(a.id) ?? null;
    const mtdActions = extractPrimaryAction(mtd?.actions, []);
    const dailyActions = extractPrimaryAction(daily?.actions, []);
    const mtdSpend = num(mtd?.spend);
    const dailySpend = num(daily?.spend);
    const creative = parseCreative(a.creative);
    return {
      id: a.id,
      ad_set_id: a.adset_id,
      campaign_id: a.campaign_id,
      client_id: clientId,
      ad_account_id: acct,
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
    };
  });

  if (adRows.length > 0) {
    const { error } = await service.from('ads').upsert(adRows, { onConflict: 'id' });
    if (error) errors.push(`ads upsert: ${error.message}`);
  }

  return errors;
}

async function refreshFromMeta(
  clientId: string,
  adAccountId: string,
  accessToken: string,
  service: ReturnType<typeof createClient>,
): Promise<RefreshResult> {
  const acct = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const errors: string[] = [];

  // List campaigns for the ad account (paginated).
  const campaignsUrl = new URL(`${META_GRAPH}/${acct}/campaigns`);
  campaignsUrl.searchParams.set('fields', 'id,name,status,objective');
  campaignsUrl.searchParams.set('access_token', accessToken);
  campaignsUrl.searchParams.set('limit', '200');
  let campaigns: Array<{ id: string; name: string; status: string; objective: string }> = [];
  try {
    campaigns = (await fetchAllPages(campaignsUrl, '/campaigns')) as any;
  } catch (e) {
    return { ok: false, error: `Meta /campaigns failed: ${(e as Error).message}` };
  }

  // Campaign insights in TWO account-level calls (this_month + yesterday),
  // keyed by campaign id — not one /insights call per campaign.
  const CAMPAIGN_INSIGHT_FIELDS =
    'spend,impressions,clicks,actions,action_values,cpc,cpm,ctr,reach,frequency,purchase_roas,website_purchase_roas';
  let campMtd: Map<string, Record<string, any>> = new Map();
  let campDaily: Map<string, Record<string, any>> = new Map();
  let campLm: Map<string, Record<string, any>> = new Map();
  let camp30: Map<string, Record<string, any>> = new Map();
  try {
    // Multiple periods so the UI can switch and the analysis bots can compare
    // across time (purchases vs reach, traffic vs CPC, …) — each is one
    // account-level call, so this is +2 requests, not a per-campaign fan-out.
    [campMtd, campDaily, campLm, camp30] = await Promise.all([
      getAccountInsights(acct, 'campaign', 'this_month', CAMPAIGN_INSIGHT_FIELDS, accessToken),
      getAccountInsights(acct, 'campaign', 'yesterday', CAMPAIGN_INSIGHT_FIELDS, accessToken),
      getAccountInsights(acct, 'campaign', 'last_month', CAMPAIGN_INSIGHT_FIELDS, accessToken),
      getAccountInsights(acct, 'campaign', 'last_30d', CAMPAIGN_INSIGHT_FIELDS, accessToken),
    ]);
  } catch (e) {
    return { ok: false, error: `Meta campaign insights failed: ${(e as Error).message}` };
  }

  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const rows: any[] = [];
  const metricRows: any[] = [];

  // Preserve manually-set strategies: any campaign flagged strategy_custom
  // keeps its stored strategy instead of the freshly parsed one.
  const customStrategy = new Map<string, string>();
  {
    const { data: existing } = await service
      .from('campaigns')
      .select('id, strategy, strategy_custom')
      .eq('ad_account_id', acct);
    for (const r of (existing ?? []) as any[]) {
      if (r.strategy_custom && r.strategy) customStrategy.set(r.id as string, r.strategy as string);
    }
  }

  const campaignIds = new Set<string>();
  for (const c of campaigns) {
    try {
      campaignIds.add(c.id);
      // Insights come from the account-level maps fetched above.
      const mtd = campMtd.get(c.id) ?? null;
      const daily = campDaily.get(c.id) ?? null;

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
        // Manual override wins; otherwise the parsed strategy. strategy_custom
        // is intentionally NOT in this payload, so the upsert leaves the flag
        // as-is (stays true for overridden rows, false/default otherwise).
        strategy: customStrategy.get(c.id) ?? strategy.name,

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

        // Full per-period metrics (every field + the raw action map) for the
        // UI period switcher and the AI analysis bots' cross-metric checks.
        metrics_by_period: {
          this_month: periodMetrics(mtd),
          last_month: periodMetrics(campLm.get(c.id) ?? null),
          last_30d: periodMetrics(camp30.get(c.id) ?? null),
        },

        last_refreshed_at: now,
        updated_at: now,
      });

      // History: one immutable-ish row per campaign per day. "yesterday"
      // insights are final by the time any refresh runs, so re-running a
      // day simply overwrites with the same numbers.
      //
      // Label the row with the date Meta actually returned (date_start), not
      // our UTC "yesterday": date_preset=yesterday is evaluated in the ad
      // account's timezone, so for accounts west of UTC the two differ near
      // the 06:00-UTC run boundary. Using the UTC label there would write the
      // row under the wrong (campaign_id, date) key and could overwrite a
      // legitimate prior day. Fall back to UTC-yesterday only if absent.
      const dailyDate = (daily?.date_start as string | undefined) ?? yesterday;
      const dailyRevenue = pickActionValue(daily?.action_values, PURCHASE_VALUE_TYPES);
      const dailyRoas =
        num(daily?.purchase_roas?.[0]?.value ?? daily?.website_purchase_roas?.[0]?.value) ||
        (dailySpend > 0 ? dailyRevenue / dailySpend : 0);
      metricRows.push({
        campaign_id: c.id,
        client_id: clientId,
        date: dailyDate,
        spend: dailySpend,
        impressions: num(daily?.impressions),
        clicks: num(daily?.clicks),
        results: dailyActions.count,
        result_type: dailyActions.type,
        metrics: {
          cpc: num(daily?.cpc),
          cpm: num(daily?.cpm),
          ctr: num(daily?.ctr),
          all_actions: dailyActions.all,
          revenue: dailyRevenue,
          roas: dailyRoas,
        },
      });
    } catch (e) {
      errors.push(`${c.id} (${c.name}): ${(e as Error).message}`);
    }
  }

  if (rows.length > 0) {
    const { error: upsertErr } = await service.from('campaigns').upsert(rows, { onConflict: 'id' });
    if (upsertErr) return { ok: false, error: `Upsert failed: ${upsertErr.message}` };
  }

  if (metricRows.length > 0) {
    const { error: histErr } = await service
      .from('campaign_metrics_daily')
      .upsert(metricRows, { onConflict: 'campaign_id,date' });
    if (histErr) errors.push(`daily metrics: ${histErr.message}`);
  }

  // Ad sets + ads: account-level batched fetch (list + insights per level),
  // not one call per campaign/ad set — that fan-out is what tripped Meta's
  // per-account rate limit.
  try {
    errors.push(...(await refreshAdSetsAndAds(acct, clientId, campaignIds, accessToken, service)));
  } catch (e) {
    errors.push(`ad_sets: ${(e as Error).message}`);
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
  if (n.includes('engagement'))
    return {
      name: 'Engagement',
      expected: ['post_engagement', 'page_engagement', 'post_reaction', 'comment', 'onsite_conversion.post_save'],
    };
  if (n.includes('purchase') || n.includes('sales') || n.includes('conversion'))
    return {
      name: 'Purchase',
      expected: ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase'],
    };
  if (objective === 'OUTCOME_LEADS' || objective === 'LEAD_GENERATION')
    return {
      name: 'Lead Generation',
      expected: ['offsite_conversion.fb_pixel_lead', 'lead', 'onsite_conversion.lead_grouped'],
    };
  if (objective === 'OUTCOME_SALES')
    return {
      name: 'Sales',
      expected: ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase'],
    };
  if (objective === 'OUTCOME_ENGAGEMENT')
    return {
      name: 'Engagement',
      expected: ['post_engagement', 'page_engagement', 'post_reaction'],
    };
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
    // Purchases — many accounts report the aggregate `omni_purchase` rather
    // than the pixel-specific type, so it must be checked first.
    'omni_purchase',
    'offsite_conversion.fb_pixel_purchase',
    'purchase',
    'onsite_web_purchase',
    'web_in_store_purchase',
    // Leads
    'offsite_conversion.fb_pixel_lead',
    'lead',
    'onsite_conversion.lead_grouped',
    // Add to cart
    'omni_add_to_cart',
    'offsite_conversion.fb_pixel_add_to_cart',
    'add_to_cart',
    // Checkout
    'omni_initiated_checkout',
    'offsite_conversion.fb_pixel_initiate_checkout',
    'initiate_checkout',
    // View content
    'omni_view_content',
    'offsite_conversion.fb_pixel_view_content',
    'view_content',
    // Traffic / engagement fallbacks
    'landing_page_view',
    'link_click',
    'post_engagement',
    'page_engagement',
    'video_view',
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
