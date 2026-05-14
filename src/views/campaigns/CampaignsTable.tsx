import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { Status } from '../../components/Status';

/**
 * Live campaigns table — reads from the `campaigns` table that
 * meta-refresh-client writes to. Can be filtered by client_id (show
 * everything under a client across all locations) or by ad_account_id
 * (show just one location's campaigns).
 */
type Row = {
  id: string;
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

export function CampaignsTable(props: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setRows([]);
      return;
    }
    let query = supabase
      .from('campaigns')
      .select(
        'id, name, status, strategy, ad_account_id, daily_spend, mtd_spend, mtd_results, mtd_result_type, mtd_cost_per_result, last_refreshed_at',
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

  const lastRefresh = rows.reduce<string | null>((latest, r) => {
    if (!r.last_refreshed_at) return latest;
    if (!latest) return r.last_refreshed_at;
    return r.last_refreshed_at > latest ? r.last_refreshed_at : latest;
  }, null);

  return (
    <div className="card">
      <div
        className="card-pad row between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="stack gap-4">
          <span className="h2">Campaigns</span>
          <span className="meta">
            {rows.length} {rows.length === 1 ? 'campaign' : 'campaigns'} · MTD
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
            {rows.map((r) => (
              <tr key={r.id}>
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
                <td className="meta" style={{ fontSize: 12 }}>
                  {r.strategy ?? '—'}
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
            ))}
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
