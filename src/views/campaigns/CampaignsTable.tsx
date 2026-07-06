import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { Status } from '../../components/Status';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

/**
 * Live campaigns table — reads from the `campaigns` table that
 * meta-refresh-client writes to. Can be filtered by client_id (show
 * everything under a client across all locations) or by ad_account_id
 * (show just one location's campaigns).
 */
type Row = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  strategy: string | null;
  ad_account_id: string | null;
  daily_spend: number;
  mtd_spend: number;
  mtd_results: number;
  mtd_result_type: string | null;
  mtd_cost_per_result: number;
  last_refreshed_at: string | null;
};

type Props =
  | { clientId: string; adAccountId?: never }
  | { clientId?: never; adAccountId: string };

// Strategies the refresh derives (parseStrategy) — the same set is offered
// when editing so a manual choice stays consistent with the auto-derived ones.
const STRATEGY_OPTIONS = [
  'Lead Generation',
  'Purchase',
  'Sales',
  'Add to Cart (Warm-up)',
  'View Content (Warm-up)',
  'Video Views (Warm-up)',
  'Traffic (Warm-up)',
  'Traffic',
  'Awareness',
  'Unknown',
];

type StatusFilter = 'active' | 'paused' | 'archived' | 'all';
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
];
function matchesFilter(status: string, f: StatusFilter): boolean {
  switch (f) {
    case 'active':
      return status === 'ACTIVE';
    case 'paused':
      return status === 'PAUSED';
    case 'archived':
      return status === 'ARCHIVED' || status === 'DELETED';
    case 'all':
      return true;
  }
}

export function CampaignsTable(props: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const workspace = useWorkspace();

  useEffect(() => {
    if (!supabase) {
      setRows([]);
      return;
    }
    let query = supabase
      .from('campaigns')
      .select(
        'id, client_id, name, status, strategy, ad_account_id, daily_spend, mtd_spend, mtd_results, mtd_result_type, mtd_cost_per_result, last_refreshed_at',
      )
      .order('mtd_spend', { ascending: false });
    if ('clientId' in props && props.clientId) {
      query = query.eq('client_id', props.clientId);
    } else if ('adAccountId' in props && props.adAccountId) {
      query = query.eq('ad_account_id', props.adAccountId);
    }
    query.then(({ data, error: e }) => {
      if (e) {
        setError(e.message);
        setRows([]);
        return;
      }
      setRows((data ?? []) as Row[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(props as any).clientId ?? (props as any).adAccountId]);

  // Persist a manual strategy override (server-side RPC marks it custom so a
  // future refresh won't overwrite it). Optimistic, with revert on error.
  async function saveStrategy(id: string, strategy: string) {
    setEditingId(null);
    if (!supabase) return;
    const current = rows?.find((r) => r.id === id)?.strategy ?? null;
    if (strategy === current) return;
    const prev = rows;
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, strategy } : r)) ?? rs);
    const { error: e } = await supabase.rpc('set_campaign_strategy', {
      p_campaign_id: id,
      p_strategy: strategy,
    });
    if (e) {
      setError(`Couldn't update strategy: ${e.message}`);
      setRows(prev);
    }
  }

  if (rows === null) {
    return <div className="meta">Loading campaigns…</div>;
  }
  if (error) {
    return (
      <div className="meta" style={{ color: 'var(--danger, #c33)' }}>
        ⚠ {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div
        className="card card-pad stack gap-6"
        style={{ borderStyle: 'dashed', textAlign: 'center', padding: 32 }}
      >
        <span style={{ fontWeight: 500 }}>No campaigns yet</span>
        <span className="meta" style={{ fontSize: 12 }}>
          Click <strong>Refresh META</strong> to pull campaigns from the Meta Marketing API.
        </span>
      </div>
    );
  }

  const visible = rows.filter((r) => matchesFilter(r.status, statusFilter));
  const lastRefresh = rows.reduce<string | null>((latest, r) => {
    if (!r.last_refreshed_at) return latest;
    if (!latest) return r.last_refreshed_at;
    return r.last_refreshed_at > latest ? r.last_refreshed_at : latest;
  }, null);

  return (
    <div className="card">
      <div
        className="card-pad row between"
        style={{ borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}
      >
        <div className="stack gap-4">
          <span className="h2">Campaigns</span>
          <span className="meta">
            {visible.length} of {rows.length} {rows.length === 1 ? 'campaign' : 'campaigns'} · MTD
            {lastRefresh && (
              <>
                {' · '}refreshed{' '}
                {new Date(lastRefresh).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </>
            )}
          </span>
        </div>
        <div className="seg">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              className={statusFilter === f.id ? 'on' : ''}
              onClick={() => setStatusFilter(f.id)}
              style={{ padding: '4px 12px', fontSize: 12 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Strategy</th>
              <th style={{ textAlign: 'right' }}>MTD Spend</th>
              <th style={{ textAlign: 'right' }}>MTD Results</th>
              <th style={{ textAlign: 'right' }}>Cost / result</th>
              <th style={{ textAlign: 'right' }}>Yesterday spend</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="meta" style={{ textAlign: 'center', padding: 24 }}>
                  No {statusFilter === 'all' ? '' : `${statusFilter} `}campaigns.
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const prefix = workspace ? `/app/${workspace.slug}` : '/dev';
              const openCampaign = () =>
                navigate(`${prefix}/clients/${r.client_id}/campaigns/${r.id}`);
              return (
                <tr key={r.id} onClick={openCampaign} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="stack gap-2">
                      <span style={{ fontWeight: 500 }}>{r.name}</span>
                      {r.ad_account_id && (
                        <span className="mono meta" style={{ fontSize: 10 }}>
                          {r.ad_account_id}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <Status s={mapStatus(r.status)} />
                  </td>
                  <td
                    className="meta"
                    style={{ fontSize: 12 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {editingId === r.id ? (
                      <select
                        autoFocus
                        value={r.strategy ?? 'Unknown'}
                        onChange={(e) => saveStrategy(r.id, e.target.value)}
                        onBlur={() => setEditingId(null)}
                        style={{
                          background: 'var(--bg-2)',
                          color: 'var(--fg)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '4px 6px',
                          font: 'inherit',
                          fontSize: 12,
                        }}
                      >
                        {STRATEGY_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        onClick={() => setEditingId(r.id)}
                        title="Click to change strategy"
                        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        {r.strategy ?? '—'}
                        <span style={{ opacity: 0.4, fontSize: 10 }}>✎</span>
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ${fmt(r.mtd_spend)}
                  </td>
                  <td
                    style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    title={r.mtd_result_type ?? undefined}
                  >
                    {fmt(r.mtd_results, 0)}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {r.mtd_results > 0 ? `$${fmt(r.mtd_cost_per_result)}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ${fmt(r.daily_spend)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(n: number | string | null | undefined, digits = 2): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0);
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function mapStatus(s: string): 'Active' | 'Paused' | 'Draft' | 'Error' {
  switch (s) {
    case 'ACTIVE':
      return 'Active';
    case 'PAUSED':
      return 'Paused';
    case 'ARCHIVED':
    case 'DELETED':
      return 'Draft';
    default:
      return 'Error';
  }
}
