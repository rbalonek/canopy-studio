import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/supabaseClient';
import { EntityCard } from '../components/EntityCard';
import { Icon } from '../components/Icon';
import { useQuery } from '../data/context';
import type { ClientCard } from '../data/types';
import { useAppState } from '../shell/AppState';
import { useWorkspace } from '../workspace/WorkspaceProvider';

const FILTER_CHIPS = ['Active campaigns', 'Has META', 'Multi-location', 'Brand 100%', 'Industry: Dental'];

type Layout = 'grid' | 'list';

export function Clients() {
  const { state } = useAppState();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const label = state.mode === 'agency' ? 'Clients' : 'Locations';
  const singular = state.mode === 'agency' ? 'client' : 'location';

  const { data: cards } = useQuery<ClientCard[]>((p) => p.listClientCards());
  const [layout, setLayout] = useState<Layout>('grid');
  const shellPrefix = workspace ? `/app/${workspace.slug}` : '/dev';
  const goToClient = (id: string) => navigate(`${shellPrefix}/clients/${id}`);

  // Aggregate live campaign data per client_id so the cards show real
  // Spend MTD + active campaign count instead of the mock placeholders.
  const [liveByClient, setLiveByClient] = useState<
    Record<string, { mtdSpend: number; activeCampaigns: number }>
  >({});
  useEffect(() => {
    if (!supabase || !workspace) return;
    supabase
      .from('campaigns')
      .select('client_id, status, mtd_spend')
      .then(({ data }) => {
        const map: Record<string, { mtdSpend: number; activeCampaigns: number }> = {};
        for (const r of data ?? []) {
          const cid = r.client_id as string;
          const agg = map[cid] ?? { mtdSpend: 0, activeCampaigns: 0 };
          agg.mtdSpend += parseFloat(String(r.mtd_spend ?? 0)) || 0;
          if (r.status === 'ACTIVE') agg.activeCampaigns += 1;
          map[cid] = agg;
        }
        setLiveByClient(map);
      });
  }, [workspace?.id, cards?.length]);

  // Merge live aggregates over the mock placeholder fields when we have
  // them. Falls back to whatever's in the ClientCard row otherwise.
  const enrichedCards = useMemo(() => {
    if (!cards) return cards;
    if (!workspace) return cards;
    return cards.map((c) => {
      const live = liveByClient[c.id];
      if (!live) return c;
      return {
        ...c,
        mtdSpend: `$${live.mtdSpend.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        activeCampaigns: live.activeCampaigns,
      };
    });
  }, [cards, liveByClient, workspace]);

  const multiLocationCount = enrichedCards?.filter((c) => c.parent).length ?? 0;

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
          {enrichedCards?.map((c) => (
            <EntityCard
              key={c.id}
              name={c.name}
              industry={c.industry}
              mtd={c.mtdSpend}
              campaigns={c.activeCampaigns}
              posts={c.postsPerWeek}
              complete={c.complete}
              onClick={() => goToClient(c.id)}
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
              {enrichedCards?.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => goToClient(c.id)}
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
