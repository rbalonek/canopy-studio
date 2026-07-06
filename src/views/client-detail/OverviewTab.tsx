import { useEffect, useMemo, useState } from 'react';
import { AreaChart } from '../../components/AreaChart';
import { KPI } from '../../components/KPI';
import { MetricPicker, usePersistentSelection } from '../../components/MetricPicker';
import { supabase } from '../../auth/supabaseClient';
import {
  DEFAULT_OVERVIEW_CARDS,
  PERIODS,
  aggregate,
  formatMetric,
  indexMetrics,
  metricsFor,
  type CampaignRow,
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
  const [daily, setDaily] = useState<{ date: string; spend: number }[]>([]);
  const [period, setPeriod] = useState<Period>('this_month');
  const [cards, setCards] = usePersistentSelection('canopy.overviewCards', DEFAULT_OVERVIEW_CARDS);
  const metrics = useMemo(() => metricsFor(rows ?? [], period), [rows, period]);
  const byKey = useMemo(() => indexMetrics(metrics), [metrics]);

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
          .select('date, spend')
          .eq('client_id', clientId)
          .order('date', { ascending: true }),
      ]);
      if (cancelled) return;
      setRows((camps ?? []) as unknown as LiveRow[]);

      const byDate = new Map<string, number>();
      for (const r of hist ?? []) {
        const d = r.date as string;
        byDate.set(d, (byDate.get(d) ?? 0) + num(r.spend));
      }
      setDaily(
        Array.from(byDate.entries())
          .map(([date, spend]) => ({ date, spend }))
          .slice(-30),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

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

  const agg = aggregate(rows, period);
  const activeCount = rows.filter((r) => r.status === 'ACTIVE').length;
  const cardDefs = cards.map((k) => byKey[k]).filter(Boolean);

  return (
    <>
      <div className="row between" style={{ marginBottom: 8, alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span className="meta">
          {activeCount} active · {rows.length} total {rows.length === 1 ? 'campaign' : 'campaigns'} ·{' '}
          {PERIODS.find((p) => p.id === period)?.label}
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
          </div>
          <MetricPicker selected={cards} onChange={setCards} metrics={metrics} label="Cards" />
        </div>
      </div>
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
          {daily.length >= 2 ? (
            <SpendArea data={daily} h={180} />
          ) : (
            <span className="meta">
              Daily spend history builds up as refreshes run each day.
            </span>
          )}
        </div>
      </div>
    </>
  );
}

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
