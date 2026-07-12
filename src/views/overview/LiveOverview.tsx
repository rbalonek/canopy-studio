import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { useAuth } from '../../auth/AuthProvider';
import { AIBadge } from '../../components/AIBadge';
import { Icon } from '../../components/Icon';
import { LogoDot } from '../../components/LogoDot';
import { aggregateDaily, formatMetric, type DailyRow, type Norm } from '../../lib/metaMetrics';
import { useAppState } from '../../shell/AppState';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { SuggestionsPanel } from '../SuggestionsPanel';

/**
 * The live Overview. Everything on it is real:
 *  - the period toggle re-aggregates campaign_metrics_daily (nightly
 *    refresh + backfill), through the same aggregateDaily → Norm path the
 *    client Overview's custom ranges use;
 *  - KPI sparklines and the Spend-over-time chart are drawn from those
 *    same day rows (no seeds, no placeholders);
 *  - the counts row reads content_posts / suggestions;
 *  - "Needs attention" is computed from live signals (failed posts,
 *    expiring Meta token, budget pace, spend-without-results) — the seeded
 *    urgent_issues fixture table is gone from the live app;
 *  - Budget pacing tracks each client's MTD spend against
 *    clients.monthly_budget with a month-end projection.
 * The /dev wireframe keeps the original mock composition in Overview.tsx.
 *
 * Data honesty note: "Yesterday" replaces the wireframe's "Today" — the
 * nightly refresh writes finalized day rows for yesterday; a "today" view
 * would read $0 most of the day and lie the rest of it.
 */

type PeriodId = 'yesterday' | '7d' | 'mtd' | '30d' | '90d';
const PERIODS: { id: PeriodId; label: string }[] = [
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7d' },
  { id: 'mtd', label: 'MTD' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
];

type Scope = 'all' | `ind:${string}` | `one:${string}` | `loc:${string}`;

type ClientLite = {
  id: string;
  name: string;
  industry: string | null;
  monthly_budget: number | null;
};
type LocationLite = { id: string; name: string; client_id: string; ad_account_id: string | null };
type CampaignLite = {
  id: string;
  client_id: string;
  ad_account_id: string | null;
  status: string | null;
  mtd_spend: number;
};
type DayRow = DailyRow & { client_id: string; campaign_id: string };

const dstr = (d: Date) => d.toISOString().slice(0, 10);

function periodRange(p: PeriodId): { start: string; end: string } {
  const now = new Date();
  const today = dstr(now);
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return dstr(d);
  };
  if (p === 'yesterday') return { start: daysAgo(1), end: daysAgo(1) };
  if (p === '7d') return { start: daysAgo(7), end: today };
  if (p === '30d') return { start: daysAgo(30), end: today };
  if (p === '90d') return { start: daysAgo(90), end: today };
  return { start: `${today.slice(0, 8)}01`, end: today }; // mtd
}

/** Real sparkline: per-day values, no seeds. */
function Spark({ values, w = 88, h = 24 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2 || values.every((v) => v === 0)) {
    return <div style={{ width: w, height: h }} />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * (w - 2) + 1).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.9} />
    </svg>
  );
}

/** Real area chart from (date, value) points. */
function RealAreaChart({
  points,
  h = 220,
  fmt,
}: {
  points: { date: string; value: number }[];
  h?: number;
  fmt: (v: number) => string;
}) {
  const w = 900; // viewBox width; scales to container
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const x = (i: number) => (points.length === 1 ? w / 2 : (i / (points.length - 1)) * (w - 16) + 8);
  const y = (v: number) => h - 24 - (v / max) * (h - 48);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${h - 24} ${line} ${x(points.length - 1).toFixed(1)},${h - 24}`;
  const mid = Math.floor(points.length / 2);
  const label = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={8}
            x2={w - 8}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="var(--border)"
            strokeDasharray="2 4"
            strokeWidth={1}
          />
        ))}
        <polygon points={area} fill="var(--accent)" opacity={0.12} />
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <text x={8} y={y(max) - 6} fill="var(--fg-3)" fontSize={11}>
          {fmt(max)}
        </text>
        <text x={8} y={h - 8} fill="var(--fg-3)" fontSize={11}>
          {label(points[0].date)}
        </text>
        {points.length > 4 && (
          <text x={w / 2} y={h - 8} fill="var(--fg-3)" fontSize={11} textAnchor="middle">
            {label(points[mid].date)}
          </text>
        )}
        <text x={w - 8} y={h - 8} fill="var(--fg-3)" fontSize={11} textAnchor="end">
          {label(points[points.length - 1].date)}
        </text>
      </svg>
    </div>
  );
}

function pickGreeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const CHART_METRICS = [
  { id: 'spend', label: 'Spend', fmt: (v: number) => formatMetric('currency', v) },
  { id: 'results', label: 'Conversions', fmt: (v: number) => formatMetric('number', v) },
  { id: 'impressions', label: 'Impressions', fmt: (v: number) => formatMetric('number', v) },
  { id: 'ctr', label: 'CTR', fmt: (v: number) => formatMetric('percent', v) },
] as const;
type ChartMetric = (typeof CHART_METRICS)[number]['id'];

export function LiveOverview() {
  const { state } = useAppState();
  const auth = useAuth();
  const workspace = useWorkspace();
  const entity = state.mode === 'agency' ? 'clients' : 'locations';

  const [clients, setClients] = useState<ClientLite[] | null>(null);
  const [locations, setLocations] = useState<LocationLite[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignLite[]>([]);
  const [days, setDays] = useState<DayRow[] | null>(null);
  const [counts, setCounts] = useState({ draft: 0, scheduled7d: 0, failed: 0, suggestions: 0 });
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [bump, setBump] = useState(0);

  const [scope, setScope] = useState<Scope>('all');
  const [picker, setPicker] = useState(false);
  const [period, setPeriod] = useState<PeriodId>('mtd');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('spend');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) return;
      const since = periodRange('90d').start;
      const in7d = new Date(Date.now() + 7 * 86_400_000).toISOString();
      const [
        clientsRes,
        locsRes,
        campsRes,
        daysRes,
        draftRes,
        schedRes,
        failedRes,
        suggRes,
        credsRes,
      ] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, industry, monthly_budget')
          .eq('workspace_id', workspace.id)
          .order('name'),
        supabase.from('locations').select('id, name, client_id, ad_account_id'),
        supabase.from('campaigns').select('id, client_id, ad_account_id, status, mtd_spend'),
        supabase
          .from('campaign_metrics_daily')
          .select('date, client_id, campaign_id, spend, impressions, clicks, results, metrics')
          .gte('date', since)
          .order('date', { ascending: true })
          .limit(20000),
        supabase
          .from('content_posts')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('status', 'draft'),
        supabase
          .from('content_posts')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('status', 'scheduled')
          .lte('publish_at', in7d),
        supabase
          .from('content_posts')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('status', 'failed'),
        supabase
          .from('suggestions')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('status', 'new'),
        supabase
          .from('workspace_meta_credentials')
          .select('expires_at')
          .eq('workspace_id', workspace.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setClients((clientsRes.data ?? []) as unknown as ClientLite[]);
      setLocations((locsRes.data ?? []) as unknown as LocationLite[]);
      setCampaigns(
        ((campsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: r.id as string,
          client_id: r.client_id as string,
          ad_account_id: (r.ad_account_id as string | null) ?? null,
          status: (r.status as string | null) ?? null,
          mtd_spend: parseFloat(String(r.mtd_spend ?? 0)) || 0,
        })),
      );
      setDays((daysRes.data ?? []) as unknown as DayRow[]);
      setCounts({
        draft: draftRes.count ?? 0,
        scheduled7d: schedRes.count ?? 0,
        failed: failedRes.count ?? 0,
        suggestions: suggRes.count ?? 0,
      });
      setTokenExpiresAt((credsRes.data?.expires_at as string | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id, bump]);

  // ---- scope filtering ------------------------------------------------------

  const clientById = useMemo(() => {
    const m = new Map<string, ClientLite>();
    for (const c of clients ?? []) m.set(c.id, c);
    return m;
  }, [clients]);

  const scopeClientIds = useMemo<Set<string> | null>(() => {
    if (scope === 'all' || scope.startsWith('loc:')) return null;
    if (scope.startsWith('ind:')) {
      const ind = scope.slice(4);
      return new Set((clients ?? []).filter((c) => c.industry === ind).map((c) => c.id));
    }
    return new Set([scope.slice(4)]); // one:<clientId>
  }, [scope, clients]);

  const scopeCampaignIds = useMemo<Set<string> | null>(() => {
    if (!scope.startsWith('loc:')) return null;
    const loc = locations.find((l) => l.id === scope.slice(4));
    if (!loc?.ad_account_id) return new Set();
    return new Set(campaigns.filter((c) => c.ad_account_id === loc.ad_account_id).map((c) => c.id));
  }, [scope, locations, campaigns]);

  const inScope = (clientId: string, campaignId?: string) => {
    if (scopeCampaignIds) return campaignId ? scopeCampaignIds.has(campaignId) : false;
    if (scopeClientIds) return scopeClientIds.has(clientId);
    return true;
  };

  // ---- period aggregation ---------------------------------------------------

  const range = periodRange(period);

  const periodRows = useMemo(
    () =>
      (days ?? []).filter(
        (r) => r.date >= range.start && r.date <= range.end && inScope(r.client_id, r.campaign_id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, range.start, range.end, scope, scopeClientIds, scopeCampaignIds],
  );

  const norm: Norm = useMemo(() => aggregateDaily(periodRows), [periodRows]);

  const perClient = useMemo(() => {
    const groups = new Map<string, DayRow[]>();
    for (const r of periodRows) {
      const list = groups.get(r.client_id) ?? [];
      list.push(r);
      groups.set(r.client_id, list);
    }
    return Array.from(groups.entries())
      .map(([clientId, rows]) => ({ clientId, norm: aggregateDaily(rows) }))
      .filter((g) => g.norm.spend > 0 || g.norm.impressions > 0)
      .sort((a, b) => b.norm.spend - a.norm.spend);
  }, [periodRows]);

  /** Daily series of a metric across the period (chart + sparks). */
  const series = useMemo(() => {
    const byDate = new Map<string, DayRow[]>();
    for (const r of periodRows) {
      const list = byDate.get(r.date) ?? [];
      list.push(r);
      byDate.set(r.date, list);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, rows]) => {
        const n = aggregateDaily(rows);
        return { date, spend: n.spend, results: n.results, impressions: n.impressions, ctr: n.ctr };
      });
  }, [periodRows]);

  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === 'ACTIVE' && inScope(c.client_id, c.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campaigns, scope, scopeClientIds, scopeCampaignIds],
  );

  // ---- budget pacing (always MTD, from the campaigns snapshot — it's
  // fresher than day rows, which lag until the nightly refresh) ------------

  const pacing = useMemo(() => {
    const spendByClient = new Map<string, number>();
    for (const c of campaigns) {
      spendByClient.set(c.client_id, (spendByClient.get(c.client_id) ?? 0) + c.mtd_spend);
    }
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthFrac = dayOfMonth / daysInMonth;
    return (clients ?? [])
      .map((c) => {
        const spend = spendByClient.get(c.id) ?? 0;
        const budget = c.monthly_budget != null ? Number(c.monthly_budget) : null;
        const projected = monthFrac > 0 ? spend / monthFrac : 0;
        const paceRatio = budget && budget > 0 ? projected / budget : null;
        return { client: c, spend, budget, projected, paceRatio };
      })
      .filter((p) => p.budget != null || p.spend > 0)
      .sort((a, b) => b.spend - a.spend);
  }, [clients, campaigns]);

  // ---- computed "needs attention" signals (replaces the fixture table) ----

  const alerts = useMemo(() => {
    const out: { sev: 'red' | 'amber'; title: string; body: string; to: string; cta: string }[] = [];
    if (counts.failed > 0) {
      out.push({
        sev: 'red',
        title: `${counts.failed} post${counts.failed === 1 ? '' : 's'} failed to publish`,
        body: 'Read the error before re-sending — a partial failure means one channel already went out.',
        to: 'publish',
        cta: 'Open Publishing Queue',
      });
    }
    if (tokenExpiresAt) {
      const daysLeft = Math.floor((new Date(tokenExpiresAt).getTime() - Date.now()) / 86_400_000);
      if (daysLeft <= 7) {
        out.push({
          sev: daysLeft <= 0 ? 'red' : 'amber',
          title: daysLeft <= 0 ? 'Facebook token expired' : `Facebook token expires in ${daysLeft}d`,
          body: 'Refreshes and publishing stop working without it. Reconnect with Facebook.',
          to: 'settings',
          cta: 'Open Settings',
        });
      }
    }
    for (const p of pacing) {
      if (p.paceRatio != null && p.paceRatio > 1.1) {
        out.push({
          sev: p.paceRatio > 1.25 ? 'red' : 'amber',
          title: `${p.client.name} pacing ${Math.round(p.paceRatio * 100)}% of budget`,
          body: `Projected $${Math.round(p.projected).toLocaleString()} vs $${Math.round(p.budget!).toLocaleString()} monthly budget.`,
          to: `clients/${p.client.id}`,
          cta: 'Review campaigns',
        });
      }
    }
    const wasted = perClient.filter((g) => g.norm.spend > 50 && g.norm.results === 0);
    for (const g of wasted.slice(0, 3)) {
      const name = clientById.get(g.clientId)?.name ?? g.clientId;
      out.push({
        sev: 'amber',
        title: `${name}: $${Math.round(g.norm.spend).toLocaleString()} spent, zero results`,
        body: `No conversions recorded this period. Check strategy/tracking or pause what isn't working.`,
        to: `clients/${g.clientId}`,
        cta: 'Open client',
      });
    }
    return out;
  }, [counts.failed, tokenExpiresAt, pacing, perClient, clientById]);

  // ---- budget editing -------------------------------------------------------

  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState('');

  async function saveBudget(clientId: string) {
    if (!supabase) return;
    const value = budgetDraft.trim() === '' ? null : Math.max(0, Number(budgetDraft) || 0);
    const { error } = await supabase
      .from('clients')
      .update({ monthly_budget: value })
      .eq('id', clientId);
    if (!error) {
      setEditingBudget(null);
      setBump((b) => b + 1);
    }
  }

  // ---- render ---------------------------------------------------------------

  if (!workspace) return null;
  const prefix = `/app/${workspace.slug}`;

  const displayName =
    (typeof auth.user?.user_metadata?.display_name === 'string'
      ? auth.user.user_metadata.display_name
      : null) ?? auth.user?.email?.split('@')[0];
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const industries = Array.from(
    new Set((clients ?? []).map((c) => c.industry).filter(Boolean)),
  ) as string[];

  const scopeLabel =
    scope === 'all'
      ? state.mode === 'agency'
        ? 'All clients'
        : 'All locations'
      : scope.startsWith('ind:')
        ? scope.slice(4)
        : scope.startsWith('loc:')
          ? locations.find((l) => l.id === scope.slice(4))?.name ?? ''
          : clientById.get(scope.slice(4))?.name ?? '';

  const chartDef = CHART_METRICS.find((m) => m.id === chartMetric)!;
  const chartPoints = series.map((s) => ({ date: s.date, value: s[chartMetric] }));
  const loading = clients === null || days === null;
  const noData = periodRows.length === 0;

  const kpis: { label: string; value: string; sparkKey: 'spend' | 'results' | 'impressions' | 'ctr' }[] = [
    { label: 'Spend', value: formatMetric('currency', norm.spend), sparkKey: 'spend' },
    { label: 'Conversions', value: formatMetric('number', norm.results), sparkKey: 'results' },
    { label: 'ROAS', value: formatMetric('roas', norm.roas), sparkKey: 'ctr' },
    { label: 'Cost / result', value: formatMetric('currency', norm.costPerResult), sparkKey: 'spend' },
  ];

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="stack gap-4">
          <span className="meta">
            {todayLabel} · <span style={{ color: 'var(--fg)' }}>{scopeLabel}</span> ·{' '}
            {clients?.length ?? 0} {entity}
          </span>
          <h1 className="h0">
            {pickGreeting(new Date())}
            {displayName ? `, ${displayName}` : ''}.
          </h1>
        </div>
        <div className="seg">
          {PERIODS.map((p) => (
            <button key={p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scope picker */}
      <div className="card card-pad stack gap-10" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div className="row gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="meta" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Scope
            </span>
            <button
              onClick={() => setScope('all')}
              className={`pill ${scope === 'all' ? 'teal' : ''}`}
              style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
            >
              {scope === 'all' && <span className="dot" />}All {entity} · {clients?.length ?? 0}
            </button>
            {industries.length > 1 && <span style={{ color: 'var(--border)' }}>│</span>}
            {industries.length > 1 &&
              industries.map((ind) => {
                const n = (clients ?? []).filter((c) => c.industry === ind).length;
                const active = scope === `ind:${ind}`;
                return (
                  <button
                    key={ind}
                    onClick={() => setScope(`ind:${ind}`)}
                    className={`pill ${active ? 'teal' : ''}`}
                    style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
                  >
                    {active && <span className="dot" />}
                    {ind} · {n}
                  </button>
                );
              })}
            <span style={{ color: 'var(--border)' }}>│</span>
            <button className="btn ghost sm" onClick={() => setPicker((v) => !v)}>
              <Icon name="users" size={12} /> Pick specific {entity}…
            </button>
          </div>
          {scope !== 'all' && (
            <button className="btn ghost sm" onClick={() => setScope('all')}>
              Clear
            </button>
          )}
        </div>
        {picker && (
          <div className="stack gap-8" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            {(clients ?? []).map((c) => {
              const clientActive = scope === `one:${c.id}`;
              const clientLocs = locations.filter((l) => l.client_id === c.id);
              return (
                <div key={c.id} className="row gap-6" style={{ flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setScope(`one:${c.id}`)}
                    className={`pill ${clientActive ? 'teal' : ''}`}
                    style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
                  >
                    {clientActive && <span className="dot" />}
                    {c.name}
                  </button>
                  {clientLocs.map((l) => {
                    const active = scope === `loc:${l.id}`;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setScope(`loc:${l.id}`)}
                        className={`pill ${active ? 'teal' : ''}`}
                        style={{ border: 0, cursor: 'pointer', font: 'inherit', opacity: l.ad_account_id ? 1 : 0.5 }}
                        disabled={!l.ad_account_id}
                        title={l.ad_account_id ? undefined : 'No ad account on this location yet'}
                      >
                        {active && <span className="dot" />}↳ {l.name}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI row — real numbers + real sparklines for the selected period */}
      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card card-pad stack gap-6">
            <span className="meta">{k.label}</span>
            <div style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {loading ? '…' : noData ? '—' : k.value}
            </div>
            <Spark values={series.map((s) => s[k.sparkKey])} />
          </div>
        ))}
      </div>

      {/* Counts row — wired */}
      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        {[
          {
            label: 'Active campaigns',
            value: String(activeCampaigns),
            meta: `in scope: ${scopeLabel}`,
            to: 'ad-performance',
          },
          {
            label: 'Posts pending approval',
            value: String(counts.draft),
            meta: counts.draft ? 'waiting for sign-off' : 'nothing in queue',
            to: 'approvals',
          },
          {
            label: 'Scheduled (next 7d)',
            value: String(counts.scheduled7d),
            meta: counts.scheduled7d ? 'going out this week' : 'nothing scheduled',
            to: 'publish',
          },
          {
            label: 'Open AI suggestions',
            value: String(counts.suggestions),
            meta: counts.suggestions ? 'below the spend chart ↓' : 'run an analysis to get some',
            ai: true,
          },
        ].map((c) => {
          const body = (
            <div className={`card card-pad stack gap-6 ${c.ai ? 'ai-surface' : ''}`} style={{ height: '100%' }}>
              <div className="row between">
                <span className="meta">{c.label}</span>
                {c.ai && <AIBadge />}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{c.value}</div>
              <span className="meta">{c.meta}</span>
            </div>
          );
          return c.to ? (
            <Link key={c.label} to={`${prefix}/${c.to}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {body}
            </Link>
          ) : (
            <div key={c.label}>{body}</div>
          );
        })}
      </div>

      {/* Budget pacing — MTD spend vs monthly budget per client */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="stack gap-2">
            <span className="h2">Monthly spend vs budget</span>
            <span className="meta" style={{ fontSize: 11 }}>
              MTD spend from the latest Meta refresh · projection = current pace carried to month-end
            </span>
          </div>
        </div>
        {pacing.length === 0 ? (
          <div className="card-pad">
            <span className="meta">No spend yet this month. Set budgets once campaigns are running.</span>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>{state.mode === 'agency' ? 'Client' : 'Location'}</th>
                <th style={{ textAlign: 'right' }}>MTD spend</th>
                <th style={{ textAlign: 'right' }}>Budget</th>
                <th style={{ width: '28%' }}>Progress</th>
                <th style={{ textAlign: 'right' }}>Projected</th>
                <th>Pace</th>
              </tr>
            </thead>
            <tbody>
              {pacing.map((p) => {
                const frac = p.budget && p.budget > 0 ? Math.min(1, p.spend / p.budget) : 0;
                const over = p.budget != null && p.spend > p.budget;
                const pace =
                  p.paceRatio == null
                    ? { label: 'no budget', color: 'var(--fg-3)' }
                    : p.paceRatio > 1.1
                      ? { label: `over · ${Math.round(p.paceRatio * 100)}%`, color: 'var(--red, #EF4444)' }
                      : p.paceRatio < 0.9
                        ? { label: `under · ${Math.round(p.paceRatio * 100)}%`, color: '#F59E0B' }
                        : { label: 'on track', color: 'var(--accent)' };
                return (
                  <tr key={p.client.id}>
                    <td>
                      <Link to={`${prefix}/clients/${p.client.id}`} className="row gap-8" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
                        <LogoDot name={p.client.name} size={24} />
                        {p.client.name}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      ${Math.round(p.spend).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {editingBudget === p.client.id ? (
                        <span className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                          $
                          <input
                            type="number"
                            autoFocus
                            value={budgetDraft}
                            onChange={(e) => setBudgetDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveBudget(p.client.id);
                              if (e.key === 'Escape') setEditingBudget(null);
                            }}
                            style={{
                              width: 80,
                              background: 'var(--bg-1)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              color: 'var(--fg)',
                              padding: '3px 6px',
                              font: 'inherit',
                            }}
                          />
                          <button className="btn primary sm" onClick={() => saveBudget(p.client.id)}>
                            ✓
                          </button>
                        </span>
                      ) : (
                        <button
                          className="btn ghost sm"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                          title="Click to set the monthly budget"
                          onClick={() => {
                            setEditingBudget(p.client.id);
                            setBudgetDraft(p.budget != null ? String(p.budget) : '');
                          }}
                        >
                          {p.budget != null ? `$${Math.round(p.budget).toLocaleString()}` : 'set budget'}
                        </button>
                      )}
                    </td>
                    <td>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 4,
                          background: 'var(--bg-2)',
                          overflow: 'hidden',
                        }}
                        title={p.budget ? `${Math.round((p.spend / p.budget) * 100)}% of budget spent` : 'No budget set'}
                      >
                        <div
                          style={{
                            width: `${Math.round(frac * 100)}%`,
                            height: '100%',
                            background: over ? 'var(--red, #EF4444)' : 'var(--accent)',
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      ${Math.round(p.projected).toLocaleString()}
                    </td>
                    <td>
                      <span className="tag" style={{ color: pace.color }}>
                        {pace.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Performance table + computed alerts */}
      <div className="grid gap-16" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="stack gap-4">
              <span className="h2">Performance by {entity}</span>
              <span className="meta">
                {PERIODS.find((p) => p.id === period)?.label} · from daily history
              </span>
            </div>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{state.mode === 'agency' ? 'Client' : 'Location'}</th>
                  <th style={{ textAlign: 'right' }}>Spend</th>
                  <th style={{ textAlign: 'right' }}>Conv.</th>
                  <th style={{ textAlign: 'right' }}>ROAS</th>
                  <th style={{ textAlign: 'right' }}>Cost/result</th>
                </tr>
              </thead>
              <tbody>
                {perClient.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
                      {loading
                        ? 'Loading…'
                        : 'No activity in this period. Daily history builds from the nightly refresh — or pull past data from a client’s Ad Accounts tab.'}
                    </td>
                  </tr>
                ) : (
                  perClient.map((g) => {
                    const name = clientById.get(g.clientId)?.name ?? g.clientId;
                    return (
                      <tr key={g.clientId}>
                        <td>
                          <Link to={`${prefix}/clients/${g.clientId}`} className="row gap-8" style={{ color: 'var(--fg)', textDecoration: 'none' }}>
                            <LogoDot name={name} size={24} />
                            {name}
                          </Link>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMetric('currency', g.norm.spend)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMetric('number', g.norm.results)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMetric('roas', g.norm.roas)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMetric('currency', g.norm.costPerResult)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ai-surface stack">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="row gap-8">
              <span className="h2">Needs attention</span>
            </div>
            <span className="meta">{alerts.length} flagged</span>
          </div>
          <div className="stack" style={{ padding: 12, gap: 10 }}>
            {alerts.length === 0 && (
              <span className="meta" style={{ padding: 8 }}>
                All clear — failed publishes, expiring connections, budget overruns, and
                spend-without-results show up here.
              </span>
            )}
            {alerts.map((a, i) => (
              <div
                key={i}
                className={`card card-pad stack gap-6 ${a.sev === 'red' ? 'bdr-red' : 'bdr-amber'}`}
                style={{ background: 'var(--bg-2)' }}
              >
                <div className="row gap-8">
                  <Icon name="warn" size={14} />
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{a.title}</span>
                </div>
                <div className="meta">{a.body}</div>
                <div>
                  <Link to={`${prefix}/${a.to}`} className="btn ai sm" style={{ textDecoration: 'none' }}>
                    {a.cta} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spend over time — real daily series */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="stack gap-4">
            <span className="h2">
              {chartDef.label} over time
            </span>
            <span className="meta">
              {PERIODS.find((p) => p.id === period)?.label} · {scopeLabel} · daily history
            </span>
          </div>
          <div className="seg">
            {CHART_METRICS.map((m) => (
              <button key={m.id} className={chartMetric === m.id ? 'on' : ''} onClick={() => setChartMetric(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: 16 }}>
          {chartPoints.length < 2 ? (
            <div
              className="stack gap-8"
              style={{
                height: 180,
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--fg-3)',
                border: '1px dashed var(--border)',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 13 }}>
                {loading ? 'Loading…' : 'Not enough daily history in this period yet'}
              </span>
              <span className="meta" style={{ fontSize: 11, textAlign: 'center', maxWidth: 420 }}>
                Day rows land with the nightly refresh; for older periods, use "Pull past data" on a
                client's Ad Accounts tab to backfill history.
              </span>
            </div>
          ) : (
            <>
              <RealAreaChart points={chartPoints} fmt={chartDef.fmt} />
              <div
                className="row gap-16"
                style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}
              >
                {perClient.slice(0, 5).map((g) => (
                  <div key={g.clientId} className="row gap-6" style={{ fontSize: 12 }}>
                    <LogoDot name={clientById.get(g.clientId)?.name ?? g.clientId} size={14} />
                    <span style={{ color: 'var(--fg-2)' }}>{clientById.get(g.clientId)?.name ?? g.clientId}</span>
                    <span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatMetric('currency', g.norm.spend)}
                    </span>
                  </div>
                ))}
                {perClient.length > 5 && <span className="meta">+{perClient.length - 5} more</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI suggestions — moved below the chart, collapsible */}
      <div id="suggestions">
        <SuggestionsPanel />
      </div>
    </div>
  );
}
