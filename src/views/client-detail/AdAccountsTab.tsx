import { Icon } from '../../components/Icon';
import { ProgressBanner } from '../../components/ProgressBanner';
import { useQuery } from '../../data/context';
import type { AdAccount, AdAccountStatus } from '../../data/types';

const STATUS_PILL: Record<AdAccountStatus, string> = {
  Active: 'green',
  Refreshing: 'indigo',
  Excluded: 'gray',
  Disconnected: 'red',
};

export function AdAccountsTab({ clientId }: { clientId: string }) {
  const { data: accounts, loading } = useQuery<AdAccount[]>(
    (p) => p.listAdAccountsForClient(clientId),
    [clientId],
  );

  if (loading) {
    return <div className="meta">Loading…</div>;
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
      >
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="plus" size={32} />
        </div>
        <div className="h2">No ad accounts connected</div>
        <div className="meta" style={{ maxWidth: 360 }}>
          Connect a META ad account to pull spend, conversions, and creatives into CanopyStudio.
        </div>
        <button className="btn primary">
          <Icon name="plus" size={13} /> Connect account
        </button>
      </div>
    );
  }

  const refreshing = accounts.find((a) => a.status === 'Refreshing');
  const excluded = accounts.filter((a) => a.status === 'Excluded');
  const connected = accounts.filter((a) => a.status !== 'Excluded');

  return (
    <div className="stack gap-12">
      <div className="row between">
        <span className="meta">
          {connected.length} connected · {excluded.length} excluded
        </span>
        <div className="row gap-8">
          <button className="btn ghost">
            <Icon name="refresh" size={13} /> Refresh all from Meta
          </button>
          <button className="btn primary">
            <Icon name="plus" size={13} /> Connect account
          </button>
        </div>
      </div>

      {refreshing && (
        <ProgressBanner
          label={`Refreshing META data for ${refreshing.accountId}`}
          pct={68}
          eta="~3m"
        />
      )}

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Account ID</th>
              <th>Currency</th>
              <th>Status</th>
              <th>Campaigns</th>
              <th>Spend MTD</th>
              <th>Last refresh</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td className="mono" style={{ color: 'var(--fg-2)', fontSize: 12 }}>
                  {r.accountId}
                </td>
                <td>{r.currency}</td>
                <td>
                  <span className={`pill ${STATUS_PILL[r.status]}`}>
                    <span className="dot" />
                    {r.status}
                  </span>
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.activeCampaigns}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.mtdSpend}</td>
                <td className="meta">{r.lastRefreshLabel}</td>
                <td>
                  <div className="row gap-4">
                    <button className="btn ghost sm">
                      <Icon name="refresh" size={12} />
                    </button>
                    <button className="btn ghost sm">
                      <Icon name="dots" size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {excluded.length > 0 && (
        <div className="card card-pad stack gap-8" style={{ background: 'var(--bg-2)' }}>
          <div className="row gap-8">
            <Icon name="warn" size={14} />
            <span style={{ fontWeight: 500, fontSize: 13 }}>
              {excluded.length} {excluded.length === 1 ? 'account' : 'accounts'} excluded from rollups
            </span>
          </div>
          {excluded.map((e) => (
            <div key={e.id} className="meta">
              “{e.name}” was hard-excluded on {e.excludedAt} by {e.excludedBy}. Reason: {e.excludedReason}.
            </div>
          ))}
          <a className="meta" style={{ color: 'var(--accent)' }}>
            Manage excluded accounts →
          </a>
        </div>
      )}
    </div>
  );
}
