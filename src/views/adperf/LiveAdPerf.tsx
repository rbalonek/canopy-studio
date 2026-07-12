import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import {
  METRICS_BY_KEY,
  PERIODS,
  aggregate,
  formatMetric,
  normalizeCampaign,
  type CampaignRow,
  type Period,
} from '../../lib/metaMetrics';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

/**
 * Live Ad Performance: the workspace-wide rollup — every client's
 * campaigns in one sortable leaderboard, with per-client subtotals and a
 * workspace total, driven by the same metrics catalog as the client
 * views (ratios recomputed from totals, never averaged). Platform chips
 * appear once Google campaigns exist alongside Meta's.
 */

type Row = CampaignRow & {
  id: string;
  client_id: string;
  name: string | null;
  status: string | null;
  platform?: string | null;
};

const COLUMNS = ['spend', 'results', 'costPerResult', 'impressions', 'clicks', 'ctr', 'roas'];

export function LiveAdPerf() {
  const workspace = useWorkspace();
  const [clients, setClients] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('this_month');
  const [platform, setPlatform] = useState<'all' | 'meta' | 'google'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) return;
      setLoading(true);
      const { data: clientRows } = await supabase
        .from('clients')
        .select('id, name')
        .eq('workspace_id', workspace.id);
      const cmap: Record<string, string> = {};
      const ids = (clientRows ?? []).map((c) => {
        cmap[c.id as string] = c.name as string;
        return c.id as string;
      });
      if (ids.length === 0) {
        if (!cancelled) {
          setClients({});
          setRows([]);
          setLoading(false);
        }
        return;
      }
      const { data: campRows } = await supabase
        .from('campaigns')
        .select(
          'id, client_id, name, status, strategy, platform, metrics_by_period, mtd_spend, impressions, clicks, cpc, cpm, ctr, reach, frequency, roas, all_mtd_actions',
        )
        .in('client_id', ids);
      if (cancelled) return;
      setClients(cmap);
      setRows((campRows ?? []) as unknown as Row[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  const platforms = useMemo(() => new Set(rows.map((r) => r.platform ?? 'meta')), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (platform === 'all' || (r.platform ?? 'meta') === platform) &&
          (clientFilter === 'all' || r.client_id === clientFilter),
      ),
    [rows, platform, clientFilter],
  );

  const ranked = useMemo(() => {
    return filtered
      .map((r) => ({ row: r, norm: normalizeCampaign(r, period) }))
      .filter((x) => x.norm.spend > 0 || x.norm.impressions > 0)
      .sort((a, b) => b.norm.spend - a.norm.spend);
  }, [filtered, period]);

  const total = useMemo(() => aggregate(filtered, period), [filtered, period]);

  const perClient = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const r of filtered) {
      const list = groups.get(r.client_id) ?? [];
      list.push(r);
      groups.set(r.client_id, list);
    }
    return Array.from(groups.entries())
      .map(([clientId, list]) => ({ clientId, norm: aggregate(list, period), count: list.length }))
      .filter((g) => g.norm.spend > 0 || g.norm.impressions > 0)
      .sort((a, b) => b.norm.spend - a.norm.spend);
  }, [filtered, period]);

  if (!workspace) return null;

  const prefix = `/app/${workspace.slug}`;
  const cols = COLUMNS.map((k) => METRICS_BY_KEY[k]).filter(Boolean);

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div className="stack gap-4">
          <h1 className="h0">Ad Performance</h1>
          <span className="meta">
            Every client's campaigns, one leaderboard · {ranked.length} active of {filtered.length}
          </span>
        </div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <div className="tabs">
            {PERIODS.map((p) => (
              <div key={p.id} className={`tab ${period === p.id ? 'on' : ''}`} onClick={() => setPeriod(p.id)}>
                {p.label}
              </div>
            ))}
          </div>
          {platforms.size > 1 && (
            <div className="tabs">
              {(['all', 'meta', 'google'] as const).map((p) => (
                <div key={p} className={`tab ${platform === p ? 'on' : ''}`} onClick={() => setPlatform(p)}>
                  {p === 'all' ? 'All platforms' : p === 'meta' ? 'Meta' : 'Google'}
                </div>
              ))}
            </div>
          )}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--fg)',
              padding: '6px 10px',
              font: 'inherit',
            }}
          >
            <option value="all">All clients</option>
            {Object.entries(clients).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <span className="meta">Loading…</span>
      ) : ranked.length === 0 ? (
        <div className="card card-pad">
          <span className="meta">
            No campaign activity in this period. Refresh a client from its Ad Accounts tab, or
            widen the period.
          </span>
        </div>
      ) : (
        <>
          {clientFilter === 'all' && perClient.length > 1 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="h2">By client</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th className="meta">Campaigns</th>
                      {cols.map((c) => (
                        <th key={c.key} style={{ textAlign: 'right' }}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perClient.map((g) => (
                      <tr key={g.clientId}>
                        <td>
                          <Link to={`${prefix}/clients/${g.clientId}`} style={{ color: 'var(--fg)' }}>
                            {clients[g.clientId] ?? g.clientId}
                          </Link>
                        </td>
                        <td className="meta">{g.count}</td>
                        {cols.map((c) => (
                          <td key={c.key} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {formatMetric(c.fmt, c.get(g.norm))}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 600 }}>
                      <td>Workspace total</td>
                      <td className="meta">{filtered.length}</td>
                      {cols.map((c) => (
                        <td key={c.key} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMetric(c.fmt, c.get(total))}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="h2">Campaign leaderboard (by spend)</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Client</th>
                    <th>Status</th>
                    {cols.map((c) => (
                      <th key={c.key} style={{ textAlign: 'right' }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(({ row, norm }) => (
                    <tr key={row.id}>
                      <td>
                        <div className="row gap-6">
                          {(row.platform ?? 'meta') === 'google' && <span className="tag">G</span>}
                          <Link
                            to={`${prefix}/clients/${row.client_id}/campaigns/${row.id}`}
                            style={{ color: 'var(--fg)' }}
                          >
                            {row.name ?? row.id}
                          </Link>
                        </div>
                      </td>
                      <td className="meta">{clients[row.client_id] ?? row.client_id}</td>
                      <td>
                        <span className="tag" style={{ color: row.status === 'ACTIVE' ? 'var(--accent)' : undefined }}>
                          {(row.status ?? '').toLowerCase() || '—'}
                        </span>
                      </td>
                      {cols.map((c) => (
                        <td key={c.key} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatMetric(c.fmt, c.get(norm))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
