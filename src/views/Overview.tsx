import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import { AIBadge } from '../components/AIBadge';
import { AreaChart } from '../components/AreaChart';
import { DeltaSpark } from '../components/DeltaSpark';
import { Icon } from '../components/Icon';
import { KPI } from '../components/KPI';
import { LogoDot } from '../components/LogoDot';
import { Status } from '../components/Status';
import { useQuery } from '../data/context';
import type { Client, ClientPerfRow, UrgentIssue } from '../data/types';
import { useAppState } from '../shell/AppState';
import { useWorkspace } from '../workspace/WorkspaceProvider';

type LiveAgg = {
  totalSpend: number;
  totalResults: number;
  activeCampaigns: number;
  avgRoas: number;
  costPerResult: number;
};

type Scope = 'all' | `ind:${string}` | `one:${string}`;

const PALETTE = ['var(--accent)', 'var(--ai)', '#F59E0B', '#EF4444', '#10B981'];
const PERIODS = ['Today', '7d', 'MTD', '30d', '90d', 'Custom'] as const;

const parseNum = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;

function pickGreeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Overview() {
  const { state } = useAppState();
  const auth = useAuth();
  const workspace = useWorkspace();
  const entity = state.mode === 'agency' ? 'clients' : 'locations';

  const { data: clients } = useQuery<Client[]>((p) => p.listClients());
  const { data: perf } = useQuery<ClientPerfRow[]>((p) => p.listClientPerf());
  const { data: urgent } = useQuery<UrgentIssue[]>((p) => p.listUrgent());

  // Aggregate KPIs from the live campaigns table (workspace-scoped via RLS).
  // Falls back to zeros until Refresh META has populated rows.
  const [live, setLive] = useState<LiveAgg | null>(null);
  useEffect(() => {
    if (!supabase || !workspace) return;
    supabase
      .from('campaigns')
      .select('status, mtd_spend, mtd_results, roas')
      .then(({ data }) => {
        const rows = data ?? [];
        const totalSpend = rows.reduce((s, r) => s + parseFloat(String(r.mtd_spend ?? 0)), 0);
        const totalResults = rows.reduce((s, r) => s + parseFloat(String(r.mtd_results ?? 0)), 0);
        const roasRows = rows
          .map((r) => parseFloat(String(r.roas ?? 0)))
          .filter((v) => v > 0);
        const avgRoas = roasRows.length ? roasRows.reduce((a, b) => a + b, 0) / roasRows.length : 0;
        const activeCampaigns = rows.filter((r) => r.status === 'ACTIVE').length;
        const costPerResult = totalResults > 0 ? totalSpend / totalResults : 0;
        setLive({ totalSpend, totalResults, activeCampaigns, avgRoas, costPerResult });
      });
  }, [workspace?.id]);

  const displayName =
    (typeof auth.user?.user_metadata?.display_name === 'string'
      ? auth.user.user_metadata.display_name
      : null) ?? auth.user?.email?.split('@')[0];
  const greeting = pickGreeting(new Date());
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const [scope, setScope] = useState<Scope>('all');
  const [picker, setPicker] = useState(false);

  const industryOf = (name: string) =>
    clients?.find((c) => c.name === name)?.industry;

  const industries = useMemo(
    () => (clients ? Array.from(new Set(clients.map((c) => c.industry))) : []),
    [clients],
  );

  const filtered = useMemo(() => {
    if (!perf) return [];
    if (scope === 'all') return perf;
    if (scope.startsWith('ind:')) {
      const ind = scope.slice(4);
      return perf.filter((r) => industryOf(r.name) === ind);
    }
    if (scope.startsWith('one:')) {
      const n = scope.slice(4);
      return perf.filter((r) => r.name === n);
    }
    return perf;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perf, scope, clients]);

  // Prefer live campaign aggregates when available (workspace context),
  // fall back to the mock-perf math for /dev showcase rendering.
  const totalSpend = live?.totalSpend ?? filtered.reduce((a, c) => a + parseNum(c.spend), 0);
  const totalConv = live?.totalResults ?? filtered.reduce((a, c) => a + c.conv, 0);
  const avgRoas =
    live?.avgRoas ??
    (filtered.length ? filtered.reduce((a, c) => a + parseNum(c.roas), 0) / filtered.length : 0);
  const avgCpl =
    live?.costPerResult ??
    (filtered.length ? filtered.reduce((a, c) => a + parseNum(c.cpl), 0) / filtered.length : 0);

  const scopeLabel =
    scope === 'all'
      ? state.mode === 'agency'
        ? 'All clients'
        : 'All locations'
      : scope.startsWith('ind:')
      ? scope.slice(4)
      : scope.slice(4);

  const totalClients = clients?.length ?? 0;

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="stack gap-4">
          <span className="meta">
            {todayLabel} · <span style={{ color: 'var(--fg)' }}>{scopeLabel}</span> ·{' '}
            {totalClients} {entity}
          </span>
          <h1 className="h0">
            {greeting}
            {displayName ? `, ${displayName}` : ''}.
          </h1>
        </div>
        <div className="row gap-8">
          <div className="seg">
            {PERIODS.map((p) => (
              <button key={p} className={p === 'MTD' ? 'on' : ''}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card card-pad stack gap-10" style={{ marginBottom: 16 }}>
        <div className="row between">
          <div className="row gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              className="meta"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              Scope
            </span>
            <button
              onClick={() => setScope('all')}
              className={`pill ${scope === 'all' ? 'teal' : ''}`}
              style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
            >
              {scope === 'all' && <span className="dot" />}All {entity} · {totalClients}
            </button>
            <span style={{ color: 'var(--border)' }}>│</span>
            {industries.map((ind) => {
              const n = perf?.filter((r) => industryOf(r.name) === ind).length ?? 0;
              if (!n) return null;
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
          <div
            className="stack gap-6"
            style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}
          >
            <span className="meta">Select one — multi-select in real build</span>
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              {perf?.map((p) => {
                const active = scope === `one:${p.name}`;
                return (
                  <button
                    key={p.name}
                    onClick={() => setScope(`one:${p.name}`)}
                    className={`pill ${active ? 'teal' : ''}`}
                    style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
                  >
                    {active && <span className="dot" />}
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        <KPI label="Total Spend" value={`$${Math.round(totalSpend).toLocaleString()}`} delta={0} seed={3} />
        <KPI label="Conversions" value={totalConv.toLocaleString()} delta={0} seed={7} />
        <KPI label="Avg ROAS" value={`${avgRoas.toFixed(1)}×`} delta={0} seed={2} />
        <KPI
          label="Avg CPL"
          value={`$${Math.round(avgCpl)}`}
          delta={0}
          seed={9}
          sub={`Scope: ${filtered.length} ${entity}`}
        />
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 24 }}>
        {[
          {
            label: 'Active campaigns',
            value: String(live?.activeCampaigns ?? 0),
            meta:
              live && live.activeCampaigns > 0
                ? `Across ${totalClients} ${entity}`
                : totalClients
                  ? `0 active across ${totalClients} ${entity}`
                  : 'No campaigns yet',
          },
          { label: 'Posts pending approval', value: '0', meta: 'Nothing in queue' },
          { label: 'Scheduled (next 7d)', value: '0', meta: 'Nothing scheduled' },
          { label: 'Open AI suggestions', value: '0', meta: 'Suggestions appear after Meta is connected', ai: true },
        ].map((c) => (
          <div key={c.label} className={`card card-pad stack gap-6 ${c.ai ? 'ai-surface' : ''}`}>
            <div className="row between">
              <span className="meta">{c.label}</span>
              {c.ai && <AIBadge />}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{c.value}</div>
            <span className="meta">{c.meta}</span>
          </div>
        ))}
      </div>

      <div
        className="grid gap-16"
        style={{ gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}
      >
        <div className="card">
          <div
            className="card-pad row between"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="stack gap-4">
              <span className="h2">Performance by {entity}</span>
              <span className="meta">Sortable · MTD</span>
            </div>
            <div className="row gap-8">
              <button className="btn sm ghost">
                <Icon name="filter" size={13} /> Filter
              </button>
              <button className="btn sm ghost">Export</button>
            </div>
          </div>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{state.mode === 'agency' ? 'Client' : 'Location'}</th>
                  <th>Spend</th>
                  <th>Conv.</th>
                  <th>ROAS</th>
                  <th>CPL</th>
                  <th>7d</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <div className="row gap-8">
                        <LogoDot name={c.name} size={24} />
                        {c.name}
                      </div>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.spend}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.conv}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.roas}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.cpl}</td>
                    <td>
                      <DeltaSpark seed={c.spark} up={c.delta >= 0} w={72} h={22} />
                    </td>
                    <td>
                      <Status s={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ai-surface stack">
          <div
            className="card-pad row between"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="row gap-8">
              <span className="h2">Urgent issues</span>
              <AIBadge />
            </div>
            <span className="meta">{urgent?.length ?? 0} flagged</span>
          </div>
          <div className="stack" style={{ padding: 12, gap: 10 }}>
            {urgent?.map((u, i) => (
              <div
                key={i}
                className={`card card-pad stack gap-6 ${u.sev === 'red' ? 'bdr-red' : 'bdr-amber'}`}
                style={{ background: 'var(--bg-2)' }}
              >
                <div className="row gap-8">
                  <Icon name="warn" size={14} />
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{u.title}</span>
                </div>
                <div className="meta">{u.body}</div>
                <div className="row gap-8">
                  <button className="btn ai sm">Take action →</button>
                  <button className="btn ghost sm">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div
          className="card-pad row between"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="stack gap-4">
            <span className="h2">Spend over time</span>
            <span className="meta">Stacked by {entity} · toggle metric</span>
          </div>
          <div className="seg">
            {['Spend', 'Conversions', 'Impressions', 'CTR'].map((p, i) => (
              <button key={p} className={i === 0 ? 'on' : ''}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: 16 }}>
          {filtered.length === 0 ? (
            <div
              className="stack gap-8"
              style={{
                height: 220,
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--fg-3)',
                border: '1px dashed var(--border)',
                borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 13 }}>No spend data yet</span>
              <span className="meta" style={{ fontSize: 11, textAlign: 'center', maxWidth: 320 }}>
                Connect a Meta ad account on a client (Clients →{' '}
                {state.mode === 'agency' ? 'a client' : 'a location'} → Ad Accounts) to start
                pulling spend over time.
              </span>
            </div>
          ) : (
            <>
              <AreaChart h={220} seeds={[1, 3, 5, 7, 9]} />
              <div
                className="row gap-16"
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                  flexWrap: 'wrap',
                }}
              >
                {filtered.slice(0, 5).map((c, i) => (
                  <div key={i} className="row gap-6" style={{ fontSize: 12 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: PALETTE[i % PALETTE.length],
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ color: 'var(--fg-2)' }}>{c.name}</span>
                    <span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {c.spend}
                    </span>
                  </div>
                ))}
                {filtered.length > 5 && (
                  <span className="meta">+{filtered.length - 5} more</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
