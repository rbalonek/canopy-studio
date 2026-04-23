import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type { ClientHeader } from '../../data/types';
import { useAppState } from '../../shell/AppState';
import { OverviewTab } from './OverviewTab';

type TabId =
  | 'overview'
  | 'brand'
  | 'assets'
  | 'scraped pages'
  | 'competitors'
  | 'ad accounts'
  | 'locations';

const BASE_TABS: TabId[] = ['overview', 'brand', 'assets', 'scraped pages', 'competitors', 'ad accounts'];

export function ClientDetail() {
  const { state } = useAppState();
  const params = useParams<{ id: string }>();
  const clientId = params.id ?? '';

  const { data: header, loading } = useQuery<ClientHeader | null>(
    (p) => p.getClientHeader(clientId),
    [clientId],
  );

  const [tab, setTab] = useState<TabId>('overview');
  const tabs: TabId[] = state.mode === 'agency' ? [...BASE_TABS, 'locations'] : BASE_TABS;

  if (loading) {
    return (
      <div className="content wide">
        <span className="meta">Loading…</span>
      </div>
    );
  }

  if (!header) {
    return (
      <div className="content wide">
        <div className="card card-pad stack gap-8">
          <span className="h2">Not found</span>
          <span className="meta">
            No {state.mode === 'agency' ? 'client' : 'location'} with id "{clientId}".
          </span>
          <Link to="/clients" className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>
            ← Back to {state.mode === 'agency' ? 'clients' : 'locations'}
          </Link>
        </div>
      </div>
    );
  }

  const initials = header.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="content wide">
      <div className="row gap-8 meta" style={{ marginBottom: 8 }}>
        <Link to="/clients" style={{ color: 'inherit', textDecoration: 'none' }}>
          {state.mode === 'agency' ? 'Clients' : 'Locations'}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>{header.name}</span>
      </div>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="row gap-12">
          <div
            className="logo-mark"
            style={{ width: 44, height: 44, fontSize: 18, borderRadius: 10 }}
          >
            {initials}
          </div>
          <div className="stack gap-4">
            <h1 className="h0">{header.name}</h1>
            <div className="row gap-8 meta">
              <span>{header.industry}</span>·
              <span>
                {header.locationCount} {header.locationCount === 1 ? 'location' : 'locations'}
              </span>
              {header.adAccountId && (
                <>
                  ·<span className="mono">{header.adAccountId}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="row gap-8">
          <button className="btn ghost">
            <Icon name="refresh" size={14} /> Refresh META
          </button>
          <button className="btn ai">
            <Icon name="sparkles" size={14} /> AI analyze
          </button>
          <button className="btn ghost">
            <Icon name="dots" size={14} />
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {tabs.map((t) => (
          <div
            key={t}
            className={`tab ${tab === t ? 'on' : ''}`}
            onClick={() => setTab(t)}
            style={{ textTransform: 'capitalize' }}
          >
            {t}
          </div>
        ))}
      </div>

      {tab === 'overview' ? (
        <OverviewTab clientId={header.id} />
      ) : (
        <div className="card card-pad stack gap-8">
          <span className="h2" style={{ textTransform: 'capitalize' }}>{tab}</span>
          <span className="meta">Coming next — this tab isn't wired up yet.</span>
        </div>
      )}
    </div>
  );
}
