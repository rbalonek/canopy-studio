import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityCard } from '../components/EntityCard';
import { Icon } from '../components/Icon';
import { useQuery } from '../data/context';
import type { ClientCard } from '../data/types';
import { useAppState } from '../shell/AppState';

const FILTER_CHIPS = ['Active campaigns', 'Has META', 'Multi-location', 'Brand 100%', 'Industry: Dental'];

type Layout = 'grid' | 'list';

export function Clients() {
  const { state } = useAppState();
  const navigate = useNavigate();
  const label = state.mode === 'agency' ? 'Clients' : 'Locations';
  const singular = state.mode === 'agency' ? 'client' : 'location';

  const { data: cards } = useQuery<ClientCard[]>((p) => p.listClientCards());
  const [layout, setLayout] = useState<Layout>('grid');
  const multiLocationCount = cards?.filter((c) => c.parent).length ?? 0;

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4">
          <h1 className="h0">{label}</h1>
          <span className="meta">
            {cards?.length ?? 0} {label.toLowerCase()} · {multiLocationCount} multi-location
          </span>
        </div>
        <div className="row gap-8">
          <div className="seg">
            <button className={layout === 'grid' ? 'on' : ''} onClick={() => setLayout('grid')}>
              <Icon name="grid" size={12} />
            </button>
            <button className={layout === 'list' ? 'on' : ''} onClick={() => setLayout('list')}>
              <Icon name="list" size={12} />
            </button>
          </div>
          <button className="btn primary">
            <Icon name="plus" size={13} /> Add {singular}
          </button>
        </div>
      </div>

      <div className="row gap-8" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="input" style={{ width: 280 }}>
          <Icon name="search" size={13} />
          <span style={{ color: 'var(--fg-2)' }}>Search…</span>
        </div>
        {FILTER_CHIPS.map((c) => (
          <span key={c} className="pill">
            {c}
          </span>
        ))}
      </div>

      {layout === 'grid' ? (
        <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
          {cards?.map((c) => (
            <EntityCard
              key={c.id}
              name={c.name}
              industry={c.industry}
              mtd={c.mtdSpend}
              campaigns={c.activeCampaigns}
              posts={c.postsPerWeek}
              complete={c.complete}
              onClick={() => navigate(`/clients/${c.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>{state.mode === 'agency' ? 'Client' : 'Location'}</th>
                <th>Industry</th>
                <th>Spend MTD</th>
                <th>Campaigns</th>
                <th>Posts / wk</th>
                <th>Brand</th>
              </tr>
            </thead>
            <tbody>
              {cards?.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/clients/${c.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div className="row gap-8">
                      <div className="logo-mark" style={{ width: 22, height: 22, fontSize: 11 }}>
                        {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </div>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                      {c.parent && <span className="tag">multi</span>}
                    </div>
                  </td>
                  <td>{c.industry}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.mtdSpend}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.activeCampaigns}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{c.postsPerWeek}</td>
                  <td>{c.complete}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
