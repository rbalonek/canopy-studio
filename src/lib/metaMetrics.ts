// Shared Meta metric catalog + normalization.
//
// A campaign row carries the flat current-month insight fields plus
// `metrics_by_period` — { this_month | last_month | last_30d } each holding the
// standard fields and the full { action_type: count } map Meta returned. This
// module turns a row (or many) into a normalized shape for a chosen period,
// exposes a catalog of metrics, and auto-discovers every action type present so
// the views can offer literally all metrics (incl. custom conversions).

export type Period = 'this_month' | 'last_month' | 'last_30d';
export const PERIODS: { id: Period; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_30d', label: 'Last 30 days' },
];

export type PeriodMetrics = {
  spend?: number | string;
  impressions?: number | string;
  clicks?: number | string;
  cpc?: number | string;
  cpm?: number | string;
  ctr?: number | string;
  reach?: number | string;
  frequency?: number | string;
  roas?: number | string;
  actions?: Record<string, number | string>;
};

export type CampaignRow = {
  strategy?: string | null;
  metrics_by_period?: Record<string, PeriodMetrics> | null;
  // Flat current-month fields — fallback for rows predating metrics_by_period.
  mtd_spend?: number | string | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  cpc?: number | string | null;
  cpm?: number | string | null;
  ctr?: number | string | null;
  reach?: number | string | null;
  frequency?: number | string | null;
  roas?: number | string | null;
  all_mtd_actions?: Record<string, number | string> | null;
};

/** Normalized, additive-friendly view of a campaign (or an aggregate). */
export type Norm = {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roas: number;
  revenue: number;
  results: number;
  costPerResult: number;
  purchases: number;
  purchaseCost: number;
  landingPageViews: number;
  lpvCost: number;
  linkClicks: number;
  linkClickCost: number;
  leads: number;
  leadCost: number;
  addToCart: number;
  postEngagement: number;
  videoViews: number;
  /** Full action map for the period — powers auto-discovered metrics. */
  actions: Record<string, number>;
};

function nn(v: unknown): number {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? x : 0;
}
function ratio(numr: number, denom: number): number {
  return denom > 0 ? numr / denom : 0;
}
/** First present (>0) among candidate action types (Meta has many synonyms). */
function pick(actions: Record<string, number>, candidates: string[]): number {
  for (const k of candidates) if (actions[k] > 0) return actions[k];
  return 0;
}

const PURCHASE = ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase', 'onsite_web_purchase'];
const LEAD = ['offsite_conversion.fb_pixel_lead', 'lead', 'onsite_conversion.lead_grouped'];
const ATC = ['omni_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart'];
const ENGAGE = ['post_engagement', 'page_engagement'];

// Mirrors the refresh's parseStrategy / extractPrimaryAction so "Results
// (strategy)" is correct for every period, computed here from the action map.
const STRATEGY_EXPECTED: Record<string, string[]> = {
  'Lead Generation': ['offsite_conversion.fb_pixel_lead', 'lead', 'onsite_conversion.lead_grouped'],
  Purchase: ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase'],
  Sales: ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase'],
  Engagement: ['post_engagement', 'page_engagement', 'post_reaction'],
  'Add to Cart (Warm-up)': ['omni_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart'],
  'View Content (Warm-up)': ['omni_view_content', 'offsite_conversion.fb_pixel_view_content', 'view_content'],
  'Video Views (Warm-up)': ['video_view'],
  'Traffic (Warm-up)': ['landing_page_view', 'link_click'],
  Traffic: ['landing_page_view', 'link_click'],
  Awareness: ['video_view', 'post_engagement', 'page_engagement'],
};
const RESULT_PRIORITY = [
  ...PURCHASE,
  ...LEAD,
  ...ATC,
  'offsite_conversion.fb_pixel_initiate_checkout',
  'initiate_checkout',
  'offsite_conversion.fb_pixel_view_content',
  'view_content',
  'landing_page_view',
  'link_click',
  'post_engagement',
  'page_engagement',
  'video_view',
];
function strategyResults(strategy: string | null | undefined, actions: Record<string, number>): number {
  const exp = STRATEGY_EXPECTED[strategy ?? ''] ?? [];
  const v = pick(actions, exp);
  return v > 0 ? v : pick(actions, RESULT_PRIORITY);
}

/** Read a campaign's fields for a given period (falling back to the flat
 * current-month columns when metrics_by_period isn't populated yet). */
function periodFields(row: CampaignRow, period: Period): {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roas: number;
  actions: Record<string, number>;
} {
  const p = row.metrics_by_period?.[period];
  const actions: Record<string, number> = {};
  if (p) {
    for (const [k, v] of Object.entries(p.actions ?? {})) actions[k] = nn(v);
    return {
      spend: nn(p.spend),
      impressions: nn(p.impressions),
      clicks: nn(p.clicks),
      reach: nn(p.reach),
      frequency: nn(p.frequency),
      cpc: nn(p.cpc),
      cpm: nn(p.cpm),
      ctr: nn(p.ctr),
      roas: nn(p.roas),
      actions,
    };
  }
  if (period === 'this_month') {
    for (const [k, v] of Object.entries(row.all_mtd_actions ?? {})) actions[k] = nn(v);
    return {
      spend: nn(row.mtd_spend),
      impressions: nn(row.impressions),
      clicks: nn(row.clicks),
      reach: nn(row.reach),
      frequency: nn(row.frequency),
      cpc: nn(row.cpc),
      cpm: nn(row.cpm),
      ctr: nn(row.ctr),
      roas: nn(row.roas),
      actions,
    };
  }
  return { spend: 0, impressions: 0, clicks: 0, reach: 0, frequency: 0, cpc: 0, cpm: 0, ctr: 0, roas: 0, actions };
}

export function normalizeCampaign(row: CampaignRow, period: Period = 'this_month'): Norm {
  const f = periodFields(row, period);
  const purchases = pick(f.actions, PURCHASE);
  const landingPageViews = pick(f.actions, ['landing_page_view']);
  const linkClicks = pick(f.actions, ['link_click']);
  const leads = pick(f.actions, LEAD);
  const results = strategyResults(row.strategy, f.actions);
  return {
    spend: f.spend,
    impressions: f.impressions,
    clicks: f.clicks,
    reach: f.reach,
    frequency: f.frequency,
    cpc: f.cpc,
    cpm: f.cpm,
    ctr: f.ctr,
    roas: f.roas,
    revenue: f.spend * f.roas,
    results,
    costPerResult: ratio(f.spend, results),
    purchases,
    purchaseCost: ratio(f.spend, purchases),
    landingPageViews,
    lpvCost: ratio(f.spend, landingPageViews),
    linkClicks,
    linkClickCost: ratio(f.spend, linkClicks),
    leads,
    leadCost: ratio(f.spend, leads),
    addToCart: pick(f.actions, ATC),
    postEngagement: pick(f.actions, ENGAGE),
    videoViews: pick(f.actions, ['video_view']),
    actions: f.actions,
  };
}

/** Aggregate campaigns: additive fields (incl. the action map) sum; ratios and
 * costs are recomputed from the totals, never averaged. */
export function aggregate(rows: CampaignRow[], period: Period = 'this_month'): Norm {
  const norms = rows.map((r) => normalizeCampaign(r, period));
  const sum = (f: (m: Norm) => number) => norms.reduce((t, m) => t + f(m), 0);
  const actions: Record<string, number> = {};
  for (const m of norms) for (const [k, v] of Object.entries(m.actions)) actions[k] = (actions[k] ?? 0) + v;

  const spend = sum((m) => m.spend);
  const impressions = sum((m) => m.impressions);
  const clicks = sum((m) => m.clicks);
  const reach = sum((m) => m.reach);
  const revenue = sum((m) => m.revenue);
  const results = sum((m) => m.results);
  const purchases = sum((m) => m.purchases);
  const landingPageViews = sum((m) => m.landingPageViews);
  const linkClicks = sum((m) => m.linkClicks);
  const leads = sum((m) => m.leads);
  return {
    spend,
    impressions,
    clicks,
    reach,
    frequency: ratio(sum((m) => m.frequency * m.reach), reach),
    cpc: ratio(spend, clicks),
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    roas: ratio(revenue, spend),
    revenue,
    results,
    costPerResult: ratio(spend, results),
    purchases,
    purchaseCost: ratio(spend, purchases),
    landingPageViews,
    lpvCost: ratio(spend, landingPageViews),
    linkClicks,
    linkClickCost: ratio(spend, linkClicks),
    leads,
    leadCost: ratio(spend, leads),
    addToCart: sum((m) => m.addToCart),
    postEngagement: sum((m) => m.postEngagement),
    videoViews: sum((m) => m.videoViews),
    actions,
  };
}

// --- Custom date range (aggregated from campaign_metrics_daily) -----------

/** One row of per-day campaign history. Matches the campaign_metrics_daily
 * table shape (spend/impressions/clicks/results columns + a `metrics` json blob
 * carrying cpc/cpm/ctr, the full action map, and — for rows captured after the
 * revenue enrichment — purchase revenue/roas). */
export type DailyRow = {
  date: string;
  spend?: number | string | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  results?: number | string | null;
  metrics?: {
    all_actions?: Record<string, number | string> | null;
    revenue?: number | string | null;
    roas?: number | string | null;
  } | null;
};

/** Aggregate per-day rows into the same additive `Norm` the preset periods use,
 * so an arbitrary date range renders through the identical metric catalog.
 *
 * Additive fields (spend, impressions, clicks, revenue, the action map, and the
 * per-day strategy `results`) sum; ratios/costs recompute from the totals.
 * Reach/frequency aren't summable across days, so they're left at 0 (shown as
 * "—" by the views). */
export function aggregateDaily(rows: DailyRow[]): Norm {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let revenue = 0;
  let results = 0;
  const actions: Record<string, number> = {};
  for (const r of rows) {
    spend += nn(r.spend);
    impressions += nn(r.impressions);
    clicks += nn(r.clicks);
    results += nn(r.results);
    revenue += nn(r.metrics?.revenue);
    for (const [k, v] of Object.entries(r.metrics?.all_actions ?? {})) {
      actions[k] = (actions[k] ?? 0) + nn(v);
    }
  }
  const purchases = pick(actions, PURCHASE);
  const landingPageViews = pick(actions, ['landing_page_view']);
  const linkClicks = pick(actions, ['link_click']);
  const leads = pick(actions, LEAD);
  return {
    spend,
    impressions,
    clicks,
    reach: 0,
    frequency: 0,
    cpc: ratio(spend, clicks),
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    roas: ratio(revenue, spend),
    revenue,
    results,
    costPerResult: ratio(spend, results),
    purchases,
    purchaseCost: ratio(spend, purchases),
    landingPageViews,
    lpvCost: ratio(spend, landingPageViews),
    linkClicks,
    linkClickCost: ratio(spend, linkClicks),
    leads,
    leadCost: ratio(spend, leads),
    addToCart: pick(actions, ATC),
    postEngagement: pick(actions, ENGAGE),
    videoViews: pick(actions, ['video_view']),
    actions,
  };
}

// --- Metric catalog -------------------------------------------------------

export type MetricFmt = 'currency' | 'number' | 'number2' | 'percent' | 'roas';
export type MetricGroup = 'Core' | 'Conversions' | 'Engagement' | 'Efficiency' | 'More actions';

export type MetricDef = {
  key: string;
  label: string;
  group: MetricGroup;
  fmt: MetricFmt;
  get: (m: Norm) => number;
};

export const METRICS: MetricDef[] = [
  { key: 'spend', label: 'Spend', group: 'Core', fmt: 'currency', get: (m) => m.spend },
  { key: 'results', label: 'Results (strategy)', group: 'Core', fmt: 'number', get: (m) => m.results },
  { key: 'costPerResult', label: 'Cost / result', group: 'Core', fmt: 'currency', get: (m) => m.costPerResult },
  { key: 'impressions', label: 'Impressions', group: 'Core', fmt: 'number', get: (m) => m.impressions },
  { key: 'reach', label: 'Reach', group: 'Core', fmt: 'number', get: (m) => m.reach },
  { key: 'frequency', label: 'Frequency', group: 'Core', fmt: 'number2', get: (m) => m.frequency },
  { key: 'clicks', label: 'Clicks (all)', group: 'Core', fmt: 'number', get: (m) => m.clicks },

  { key: 'purchases', label: 'Purchases', group: 'Conversions', fmt: 'number', get: (m) => m.purchases },
  { key: 'roas', label: 'Purchase ROAS', group: 'Conversions', fmt: 'roas', get: (m) => m.roas },
  { key: 'purchaseCost', label: 'Cost / purchase', group: 'Conversions', fmt: 'currency', get: (m) => m.purchaseCost },
  { key: 'revenue', label: 'Revenue (est.)', group: 'Conversions', fmt: 'currency', get: (m) => m.revenue },
  { key: 'leads', label: 'Leads', group: 'Conversions', fmt: 'number', get: (m) => m.leads },
  { key: 'leadCost', label: 'Cost / lead', group: 'Conversions', fmt: 'currency', get: (m) => m.leadCost },
  { key: 'addToCart', label: 'Add to cart', group: 'Conversions', fmt: 'number', get: (m) => m.addToCart },
  { key: 'landingPageViews', label: 'Landing page views', group: 'Conversions', fmt: 'number', get: (m) => m.landingPageViews },

  { key: 'linkClicks', label: 'Link clicks', group: 'Engagement', fmt: 'number', get: (m) => m.linkClicks },
  { key: 'postEngagement', label: 'Post engagement', group: 'Engagement', fmt: 'number', get: (m) => m.postEngagement },
  { key: 'videoViews', label: 'Video views', group: 'Engagement', fmt: 'number', get: (m) => m.videoViews },

  { key: 'cpc', label: 'CPC', group: 'Efficiency', fmt: 'currency', get: (m) => m.cpc },
  { key: 'cpm', label: 'CPM', group: 'Efficiency', fmt: 'currency', get: (m) => m.cpm },
  { key: 'ctr', label: 'CTR', group: 'Efficiency', fmt: 'percent', get: (m) => m.ctr },
  { key: 'lpvCost', label: 'Cost / landing page view', group: 'Efficiency', fmt: 'currency', get: (m) => m.lpvCost },
  { key: 'linkClickCost', label: 'Cost / link click', group: 'Efficiency', fmt: 'currency', get: (m) => m.linkClickCost },
];

// Action types already surfaced by a curated metric — excluded from the
// auto-discovered "More actions" group to avoid duplicates.
const COVERED_ACTIONS = new Set<string>([
  ...PURCHASE,
  ...LEAD,
  ...ATC,
  ...ENGAGE,
  'landing_page_view',
  'link_click',
  'video_view',
]);

const FRIENDLY_ACTION: Record<string, string> = {
  view_content: 'View content',
  omni_view_content: 'View content (omni)',
  post_reaction: 'Post reactions',
  comment: 'Comments',
  'onsite_conversion.post_save': 'Post saves',
  'onsite_conversion.messaging_conversation_started_7d': 'Messaging conversations',
  omni_landing_page_view: 'Landing page views (omni)',
  post_interaction_gross: 'Post interactions (gross)',
  post_interaction_net: 'Post interactions (net)',
  'onsite_conversion.post_net_like': 'Page likes',
  initiate_checkout: 'Checkouts initiated',
  omni_initiated_checkout: 'Checkouts initiated (omni)',
};

/** Human label for a raw Meta action type. Custom-conversion pixel ids get a
 * short suffix so they're at least identifiable. */
export function prettyAction(type: string): string {
  if (FRIENDLY_ACTION[type]) return FRIENDLY_ACTION[type];
  if (type.startsWith('offsite_conversion.custom.')) return `Custom conversion …${type.slice(-6)}`;
  const s = type
    .replace(/^offsite_conversion\.fb_pixel_/, '')
    .replace(/^onsite_(web_app_|web_)?/, '')
    .replace(/^offsite_conversion\./, '')
    .replace(/_/g, ' ')
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Turn a set of present action types into "More actions" count metrics,
 * excluding those already surfaced by a curated metric. */
function actionMetricsFromKeys(present: Iterable<string>): MetricDef[] {
  return [...new Set(present)].sort().map((type) => ({
    key: `action:${type}`,
    label: prettyAction(type),
    group: 'More actions' as MetricGroup,
    fmt: 'number' as MetricFmt,
    get: (m: Norm) => m.actions[type] ?? 0,
  }));
}

/** Every action type present in the data (for the chosen period) that isn't
 * already a curated metric — turned into count metrics. */
export function discoverActionMetrics(rows: CampaignRow[], period: Period = 'this_month'): MetricDef[] {
  const present = new Set<string>();
  for (const r of rows) {
    const norm = normalizeCampaign(r, period);
    for (const k of Object.keys(norm.actions)) {
      if (!COVERED_ACTIONS.has(k) && norm.actions[k] > 0) present.add(k);
    }
  }
  return actionMetricsFromKeys(present);
}

/** Same discovery, but from an already-aggregated Norm (used by the custom
 * date-range path, which aggregates daily rows rather than campaign rows). */
export function discoverActionMetricsFromNorm(norm: Norm): MetricDef[] {
  const present: string[] = [];
  for (const [k, v] of Object.entries(norm.actions)) {
    if (!COVERED_ACTIONS.has(k) && v > 0) present.push(k);
  }
  return actionMetricsFromKeys(present);
}

/** Curated catalog + everything discovered in the data. */
export function metricsFor(rows: CampaignRow[], period: Period = 'this_month'): MetricDef[] {
  return [...METRICS, ...discoverActionMetrics(rows, period)];
}
export function metricsForNorm(norm: Norm): MetricDef[] {
  return [...METRICS, ...discoverActionMetricsFromNorm(norm)];
}
export function indexMetrics(list: MetricDef[]): Record<string, MetricDef> {
  return Object.fromEntries(list.map((m) => [m.key, m]));
}

export const METRICS_BY_KEY: Record<string, MetricDef> = indexMetrics(METRICS);

export function formatMetric(fmt: MetricFmt, v: number): string {
  if (!Number.isFinite(v)) v = 0;
  switch (fmt) {
    case 'currency':
      return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'number':
      return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    case 'number2':
      return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'percent':
      return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
    case 'roas':
      return v > 0 ? `${v.toFixed(2)}×` : '—';
  }
}

/** Sensible defaults so the views are useful before the user customizes. */
export const DEFAULT_CAMPAIGN_COLUMNS = [
  'spend',
  'purchases',
  'roas',
  'purchaseCost',
  'landingPageViews',
  'cpc',
];
export const DEFAULT_OVERVIEW_CARDS = [
  'spend',
  'purchases',
  'roas',
  'purchaseCost',
  'landingPageViews',
  'lpvCost',
  'linkClicks',
  'ctr',
];
