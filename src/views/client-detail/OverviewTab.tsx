import { useEffect, useMemo, useState } from 'react';
import { AreaChart } from '../../components/AreaChart';
import { KPI } from '../../components/KPI';
import { MetricPicker, usePersistentSelection } from '../../components/MetricPicker';
import { supabase } from '../../auth/supabaseClient';
import {
  DEFAULT_OVERVIEW_CARDS,
  PERIODS,
  aggregate,
  aggregateDaily,
  formatMetric,
  indexMetrics,
  metricsFor,
  metricsForNorm,
  type CampaignRow,
  type DailyRow,
  type Period,
} from '../../lib/metaMetrics';
import { useQuery } from '../../data/context';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import type { ClientKpis } from '../../data/types';

export function OverviewTab({ clientId }: { clientId: string }) {
  const workspace = useWorkspace();
  if (workspace) return <LiveOverviewTab clientId={clientId} />;
  return <WireframeOverviewTab clientId={clientId} />;
}

// ---------------------------------------------------------------------------
// Live: account-total metric cards (user-selectable) aggregated from the
// client's real campaigns + a spend-over-time series from campaign_metrics_daily.
// ---------------------------------------------------------------------------

type LiveRow = CampaignRow & { status?: string };

const OVERVIEW_SELECT =
  'status, strategy, mtd_spend, impressions, clicks, cpc, cpm, ctr, reach, frequency, roas, all_mtd_actions, metrics_by_period';

function LiveOverviewTab({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<LiveRow[] | null | undefined>(undefined);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [period, setPeriod] = useState<Period | 'custom'>('this_month');
  const [range, setRange] = useState(() => defaultRange());
  const [cards, setCards] = usePersistentSelection('canopy.overviewCards', DEFAULT_OVERVIEW_CARDS);

  const isCustom = period === 'custom';

  useEffect(() => {
    if (!supabase) {
      setRows(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: camps }, { data: hist }] = await Promise.all([
        supabase!.from('campaigns').select(OVERVIEW_SELECT).eq('client_id', clientId),
        supabase!
          .from('campaign_metrics_daily')
          .select('date, spend, impressions, clicks, results, metrics')
          .eq('client_id', clientId)
          .order('date', { ascending: true }),
      ]);
      if (cancelled) return;
      setRows((camps ?? []) as unknown as LiveRow[]);
      setDaily((hist ?? []) as unknown as DailyRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Per-campaign-day rows inside the chosen custom range (a no-op for presets).
  const dailyInRange = useMemo(
    () => daily.filter((r) => r.date >= range.start && r.date <= range.end),
    [daily, range.start, range.end],
  );

  const agg = useMemo(
    () => (isCustom ? aggregateDaily(dailyInRange) : aggregate(rows ?? [], period as Period)),
    [isCustom, dailyInRange, rows, period],
  );

  // Custom ranges are aggregated from daily rows, which can't sum reach /
  // frequency — hide those so users don't pick misleading zeros.
  const metrics = useMemo(
    () =>
      isCustom
        ? metricsForNorm(agg).filter((m) => m.key !== 'reach' && m.key !== 'frequency')
        : metricsFor(rows ?? [], period as Period),
    [isCustom, agg, rows, period],
  );
  const byKey = useMemo(() => indexMetrics(metrics), [metrics]);

  // Spend-over-time series: custom → summed per day within the range; preset →
  // last 30 days of history regardless of the KPI period.
  const chartData = useMemo(() => {
    const src = isCustom ? dailyInRange : daily;
    const byDate = new Map<string, number>();
    for (const r of src) byDate.set(r.date, (byDate.get(r.date) ?? 0) + num(r.spend));
    const arr = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, spend]) => ({ date, spend }));
    return isCustom ? arr : arr.slice(-30);
  }, [isCustom, daily, dailyInRange]);

  if (rows === undefined) return <div className="meta">Loading…</div>;
  if (!rows || rows.length === 0) {
    return (
      <div className="card card-pad stack gap-6">
        <span style={{ fontWeight: 500 }}>No campaign data yet</span>
        <span className="meta" style={{ fontSize: 12 }}>
          Connect a Meta account on the <strong>Ad Accounts</strong> tab and click{' '}
          <strong>Refresh META</strong> to pull campaigns.
        </span>
      </div>
    );
  }

  const activeCount = rows.filter((r) => r.status === 'ACTIVE').length;
  const cardDefs = cards.map((k) => byKey[k]).filter(Boolean);
  const label = isCustom
    ? `${range.start} → ${range.end}`
    : PERIODS.find((p) => p.id === period)?.label;
  const customEmpty = isCustom && dailyInRange.length === 0;

  return (
    <>
      <div className="row between" style={{ marginBottom: 8, alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span className="meta">
          {activeCount} active · {rows.length} total {rows.length === 1 ? 'campaign' : 'campaigns'} · {label}
        </span>
        <div className="row gap-8">
          <div className="seg">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                className={period === p.id ? 'on' : ''}
                onClick={() => setPeriod(p.id)}
                style={{ padding: '4px 12px', fontSize: 12 }}
              >
                {p.label}
              </button>
            ))}
            <button
              className={isCustom ? 'on' : ''}
              onClick={() => setPeriod('custom')}
              style={{ padding: '4px 12px', fontSize: 12 }}
            >
              Custom
            </button>
          </div>
          <MetricPicker selected={cards} onChange={setCards} metrics={metrics} label="Cards" />
        </div>
      </div>

      {isCustom && (
        <div
          className="row gap-8"
          style={{ marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <input
            type="date"
            value={range.start}
            max={range.end}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            style={dateInputStyle}
          />
          <span className="meta">→</span>
          <input
            type="date"
            value={range.end}
            min={range.start}
            max={todayISO()}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            style={dateInputStyle}
          />
          <div className="seg">
            <button style={presetBtnStyle} onClick={() => setRange(thisYearRange())}>
              This year
            </button>
            <button style={presetBtnStyle} onClick={() => setRange(lastYearRange())}>
              Last year
            </button>
          </div>
        </div>
      )}

      {customEmpty ? (
        <div className="card card-pad stack gap-6">
          <span style={{ fontWeight: 500 }}>No history for this range</span>
          <span className="meta" style={{ fontSize: 12 }}>
            Daily history only exists from when refreshes started. To view an earlier period, go to
            the <strong>Ad Accounts</strong> tab and use <strong>Pull past data</strong> to backfill
            it from Meta.
          </span>
        </div>
      ) : (
        <>
          <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
            {cardDefs.map((m) => (
              <KPI key={m.key} label={m.label} value={formatMetric(m.fmt, m.get(agg))} noData />
            ))}
          </div>
          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="h2">Spend over time</span>
            </div>
            <div style={{ padding: 16 }}>
              {chartData.length >= 2 ? (
                <SpendArea data={chartData} h={180} />
              ) : (
                <span className="meta">
                  Daily spend history builds up as refreshes run each day.
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function thisYearRange(): { start: string; end: string } {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: todayISO() };
}
function lastYearRange(): { start: string; end: string } {
  const y = new Date().getFullYear() - 1;
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}
function defaultRange(): { start: string; end: string } {
  return thisYearRange();
}

const dateInputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  padding: '4px 8px',
  font: 'inherit',
  fontSize: 12,
};
const presetBtnStyle: React.CSSProperties = { padding: '4px 12px', fontSize: 12 };

/** Minimal real area chart for the daily spend series (honest data, not the
 * decorative AreaChart seeds). */
function SpendArea({ data, h }: { data: { date: string; spend: number }[]; h: number }) {
  const W = 800;
  const H = h;
  const max = Math.max(...data.map((d) => d.spend), 1);
  const sx = data.length > 1 ? W / (data.length - 1) : W;
  const y = (v: number) => H - (v / max) * (H - 24) - 8;
  const line = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${(i * sx).toFixed(1)},${y(d.spend).toFixed(1)}`)
    .join(' ');
  const lastX = ((data.length - 1) * sx).toFixed(1);
  const area = `${line} L${lastX},${H} L0,${H} Z`;
  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1="0"
          x2={W}
          y1={H * p}
          y2={H * p}
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
      ))}
      <path d={area} fill="var(--accent)" fillOpacity="0.18" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

function num(v: unknown): number {
  const x = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? x : 0;
}

// ---------------------------------------------------------------------------
// Wireframe (/dev) — original mock-backed view, unchanged
// ---------------------------------------------------------------------------

function WireframeOverviewTab({ clientId }: { clientId: string }) {
  const { data: kpis, loading } = useQuery<ClientKpis | null>(
    (p) => p.getClientKpis(clientId),
    [clientId],
  );

  if (loading) {
    return <div className="meta">Loading…</div>;
  }
  if (!kpis) {
    return (
      <div className="card card-pad">
        <span className="meta">No KPI data for this client yet.</span>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        <KPI label="Spend MTD" value={kpis.spend.value} delta={kpis.spend.delta} seed={kpis.spend.seed} />
        <KPI label="Conversions" value={kpis.conversions.value} delta={kpis.conversions.delta} seed={kpis.conversions.seed} />
        <KPI label="ROAS" value={kpis.roas.value} delta={kpis.roas.delta} seed={kpis.roas.seed} />
        <KPI label="CPL" value={kpis.cpl.value} delta={kpis.cpl.delta} seed={kpis.cpl.seed} />
      </div>
      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Spend over time</span>
        </div>
        <div style={{ padding: 16 }}>
          <AreaChart h={180} seeds={[1, 3, 5]} />
        </div>
      </div>
    </>
  );
}
