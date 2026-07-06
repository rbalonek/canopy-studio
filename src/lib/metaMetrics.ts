// Shared Meta metric catalog.
//
// A campaign row (from the `campaigns` table) carries the standard insight
// fields plus `all_mtd_actions` — the full { action_type: count } map Meta
// returned. This module turns a row (or a set of rows) into a normalized shape
// and exposes a catalog of metrics so the campaigns table and the client
// overview can let the user choose exactly what to display, all off the data
// we already store (no extra Meta calls).

export type CampaignRow = {
  mtd_spend?: number | string | null;
  impressions?: number | string | null;
  clicks?: number | string | null;
  cpc?: number | string | null;
  cpm?: number | string | null;
  ctr?: number | string | null;
  reach?: number | string | null;
  frequency?: number | string | null;
  roas?: number | string | null;
  mtd_results?: number | string | null;
  mtd_cost_per_result?: number | string | null;
  all_mtd_actions?: Record<string, number | string> | null;
};

/** Normalized, additive-friendly view of a campaign (or an aggregate of many). */
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
};

function n(v: unknown): number {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? x : 0;
}

/** First present (>0) value among candidate action types — handles Meta's many
 * synonyms (e.g. omni_purchase vs offsite_conversion.fb_pixel_purchase). */
function pick(actions: Record<string, number>, candidates: string[]): number {
  for (const k of candidates) {
    if (actions[k] > 0) return actions[k];
  }
  return 0;
}

const PURCHASE = ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase', 'onsite_web_purchase'];
const LEAD = ['offsite_conversion.fb_pixel_lead', 'lead', 'onsite_conversion.lead_grouped'];
const ATC = ['omni_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart', 'add_to_cart'];
const ENGAGE = ['post_engagement', 'page_engagement'];

function ratio(numr: number, denom: number): number {
  return denom > 0 ? numr / denom : 0;
}

/** Normalize one campaign row. Ratios come from Meta's own values where stored
 * (more accurate than recomputing per row); counts come from the action map. */
export function normalizeCampaign(row: CampaignRow): Norm {
  const actions: Record<string, number> = {};
  for (const [k, v] of Object.entries(row.all_mtd_actions ?? {})) actions[k] = n(v);

  const spend = n(row.mtd_spend);
  const roas = n(row.roas);
  const purchases = pick(actions, PURCHASE);
  const landingPageViews = pick(actions, ['landing_page_view']);
  const linkClicks = pick(actions, ['link_click']);
  const leads = pick(actions, LEAD);
  return {
    spend,
    impressions: n(row.impressions),
    clicks: n(row.clicks),
    reach: n(row.reach),
    frequency: n(row.frequency),
    cpc: n(row.cpc),
    cpm: n(row.cpm),
    ctr: n(row.ctr),
    roas,
    revenue: spend * roas,
    results: n(row.mtd_results),
    costPerResult: n(row.mtd_cost_per_result),
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
  };
}

/** Aggregate many campaigns: additive fields sum; ratios/costs are recomputed
 * from the totals (never averaged). */
export function aggregate(rows: CampaignRow[]): Norm {
  const norms = rows.map(normalizeCampaign);
  const sum = (f: (m: Norm) => number) => norms.reduce((t, m) => t + f(m), 0);
  const spend = sum((m) => m.spend);
  const impressions = sum((m) => m.impressions);
  const clicks = sum((m) => m.clicks);
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
    reach: sum((m) => m.reach),
    frequency: ratio(sum((m) => m.frequency * m.reach), sum((m) => m.reach)) || 0,
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
  };
}

// --- Metric catalog -------------------------------------------------------

export type MetricFmt = 'currency' | 'number' | 'number2' | 'percent' | 'roas';
export type MetricGroup = 'Core' | 'Conversions' | 'Engagement' | 'Efficiency';

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

export const METRICS_BY_KEY: Record<string, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.key, m]),
);

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
