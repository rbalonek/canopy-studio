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

type CampaignRow = {
  client_id: string;
  ad_account_id: string | null;
  status: string | null;
  mtd_spend: number;
  mtd_results: number;
  roas: number;
};

type LocationLite = {
  id: string;
  name: string;
  client_id: string;
  ad_account_id: string | null;
};

type Scope = 'all' | `ind:${string}` | `one:${string}` | `loc:${string}`;

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

  // Pull live campaigns (workspace-scoped via RLS). We keep the raw rows
  // so we can re-aggregate when the user filters by scope (industry /
  // single client / single location) without re-querying.
  const [campaignRows, setCampaignRows] = useState<CampaignRow[] | null>(null);
  useEffect(() => {
    if (!supabase || !workspace) return;
    supabase
      .from('campaigns')
      .select('client_id, ad_account_id, status, mtd_spend, mtd_results, roas')
      .then(({ data }) => {
        const rows = (data ?? []).map((r) => ({
          client_id: r.client_id as string,
          ad_account_id: (r.ad_account_id as string | null) ?? null,
          status: (r.status as string | null) ?? null,
          mtd_spend: parseFloat(String(r.mtd_spend ?? 0)) || 0,
          mtd_results: parseFloat(String(r.mtd_results ?? 0)) || 0,
          roas: parseFloat(String(r.roas ?? 0)) || 0,
        }));
        setCampaignRows(rows);
      });
  }, [workspace?.id]);

  // Pull locations so the picker can offer sub-location selection for
  // multi-location clients (Big Air → Big Air - Burnsville, …).
  const [locations, setLocations] = useState<LocationLite[] | null>(null);
  useEffect(() => {
    if (!supabase || !workspace) return;
    supabase
      .from('locations')
      .select('id, name, client_id, ad_account_id')
      .then(({ data }) => {
        setLocations(
          (data ?? []).map((r) => ({
            id: r.id as string,
            name: r.name as string,
            client_id: r.client_id as string,
            ad_account_id: (r.ad_account_id as string | null) ?? null,
          })),
        );
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

  // Re-aggregate live campaigns whenever scope (all / industry / one client /
  // one location) changes. Location scope filters by ad_account_id since
  // each location is its own ad account.
  const live: LiveAgg | null = useMemo(() => {
    if (!campaignRows) return null;
    const scoped = campaignRows.filter((r) => {
      if (scope === 'all') return true;
      if (scope.startsWith('loc:')) {
        const locId = scope.slice(4);
        const loc = locations?.find((l) => l.id === locId);
        return !!loc?.ad_account_id && r.ad_account_id === loc.ad_account_id;
      }
      const cl = clients?.find((c) => c.id === r.client_id);
      if (!cl) return false;
      if (scope.startsWith('ind:')) return cl.industry === scope.slice(4);
      if (scope.startsWith('one:')) return cl.name === scope.slice(4);
      return true;
    });
    const totalSpend = scoped.reduce((s, r) => s + r.mtd_spend, 0);
    const totalResults = scoped.reduce((s, r) => s + r.mtd_results, 0);
    const roasVals = scoped.map((r) => r.roas).filter((v) => v > 0);
    const avgRoas = roasVals.length ? roasVals.reduce((a, b) => a + b, 0) / roasVals.length : 0;
    const activeCampaigns = scoped.filter((r) => r.status === 'ACTIVE').length;
    const costPerResult = totalResults > 0 ? totalSpend / totalResults : 0;
    return { totalSpend, totalResults, activeCampaigns, avgRoas, costPerResult };
  }, [campaignRows, scope, clients, locations]);

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
  // For honesty in sparklines: noData iff we're rendering live aggregates and
  // they're all zero. On /dev/* with mock perf, leave deltas/sparks alone.
  const noData = !!live && live.totalSpend === 0 && live.totalResults === 0;

  // Per-client live aggregates for the Performance by clients table.
  // Group campaign rows by client_id, fold in industry from clients.
  const livePerf = useMemo<ClientPerfRow[] | null>(() => {
    if (!campaignRows || !clients) return null;
    const byClient = new Map<
      string,
      { spend: number; results: number; roasVals: number[] }
    >();
    for (const r of campaignRows) {
      const agg = byClient.get(r.client_id) ?? { spend: 0, results: 0, roasVals: [] };
      agg.spend += r.mtd_spend;
      agg.results += r.mtd_results;
      if (r.roas > 0) agg.roasVals.push(r.roas);
      byClient.set(r.client_id, agg);
    }
    const out: ClientPerfRow[] = [];
    for (const c of clients) {
      const agg = byClient.get(c.id);
      if (!agg) continue;
      const roas = agg.roasVals.length
        ? `${(agg.roasVals.reduce((a, b) => a + b, 0) / agg.roasVals.length).toFixed(1)}x`
        : '—';
      const cpl = agg.results > 0 ? `$${Math.round(agg.spend / agg.results)}` : '—';
      out.push({
        name: c.name,
        spend: `$${Math.round(agg.spend).toLocaleString()}`,
        conv: Math.round(agg.results),
        roas,
        cpl,
        spark: 0,
        status: 'Active',
        delta: 0,
      });
    }
    return out;
  }, [campaignRows, clients]);

  // Choose mock vs live for the table + chart legend.
  const tableRows = live !== null ? (livePerf ?? []) : filtered;

  const scopeLabel =
    scope === 'all'
      ? state.mode === 'agency'
        ? 'All clients'
        : 'All locations'
      : scope.startsWith('ind:')
        ? scope.slice(4)
        : scope.startsWith('loc:')
          ? locations?.find((l) => l.id === scope.slice(4))?.name ?? scope.slice(4)
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
              const n = clients?.filter((c) => c.industry === ind).length ?? 0;
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
            <span className="meta">
              {clients?.length
                ? `Select one — multi-select in real build`
                : `No ${entity} yet. Add one from the ${
                    state.mode === 'agency' ? 'Clients' : 'Locations'
                  } page first.`}
            </span>
            <div className="stack gap-8">
              {clients?.map((c) => {
                const clientActive = scope === `one:${c.name}`;
                const clientLocs = locations?.filter((l) => l.client_id === c.id) ?? [];
                return (
                  <div key={c.id} className="row gap-6" style={{ flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setScope(`one:${c.name}`)}
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
                          style={{
                            border: 0,
                            cursor: 'pointer',
                            font: 'inherit',
                            opacity: l.ad_account_id ? 1 : 0.5,
                          }}
                          title={
                            l.ad_account_id
                              ? undefined
                              : 'No ad account set on this location yet — campaign filter unavailable'
                          }
                          disabled={!l.ad_account_id}
                        >
                          {active && <span className="dot" />}
                          ↳ {l.name}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        <KPI
          label="Total Spend"
          value={`$${Math.round(totalSpend).toLocaleString()}`}
          delta={0}
          seed={3}
          noData={noData}
        />
        <KPI
          label="Conversions"
          value={totalConv.toLocaleString()}
          delta={0}
          seed={7}
          noData={noData}
        />
        <KPI
          label="Avg ROAS"
          value={`${avgRoas.toFixed(1)}×`}
          delta={0}
          seed={2}
          noData={noData}
        />
        <KPI
          label="Avg CPL"
          value={`$${Math.round(avgCpl)}`}
          delta={0}
          seed={9}
          sub={`Scope: ${totalClients} ${entity}`}
          noData={noData}
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
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
                      No campaigns refreshed yet — visit a client and hit Refresh META.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((c, i) => (
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
                        {live !== null ? (
                          <span className="meta" style={{ fontSize: 11 }}>
                            —
                          </span>
                        ) : (
                          <DeltaSpark seed={c.spark} up={c.delta >= 0} w={72} h={22} />
                        )}
                      </td>
                      <td>
                        <Status s={c.status} />
                      </td>
                    </tr>
                  ))
                )}
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
          {live !== null || filtered.length === 0 ? (
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
              <span style={{ fontSize: 13 }}>
                {live && live.totalSpend > 0
                  ? 'Daily breakdown not pulled yet'
                  : 'No spend data yet'}
              </span>
              <span className="meta" style={{ fontSize: 11, textAlign: 'center', maxWidth: 360 }}>
                {live && live.totalSpend > 0
                  ? `Aggregate MTD spend is $${Math.round(live.totalSpend).toLocaleString()}. Per-day time-series lands when we port multi-period insights from ad-optimizer — until then this chart is intentionally empty.`
                  : `Connect a Meta ad account on a client (Clients → ${state.mode === 'agency' ? 'a client' : 'a location'} → Ad Accounts) to start pulling spend over time.`}
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
