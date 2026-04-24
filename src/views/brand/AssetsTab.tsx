import { useMemo, useState } from 'react';
import { AdThumb, type AdThumbKind } from '../../components/AdThumb';
import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type { Asset, AssetKind, Client } from '../../data/types';

type Filter = 'All clients' | 'Photos' | 'Videos' | 'Logos' | 'AI-analyzed';

const FILTERS: Filter[] = ['All clients', 'Photos', 'Videos', 'Logos', 'AI-analyzed'];

const FILTER_KIND: Record<Exclude<Filter, 'All clients' | 'AI-analyzed'>, AssetKind> = {
  Photos: 'Photo',
  Videos: 'Video',
  Logos: 'Logo',
};

const KIND_TO_ADTHUMB: Record<AssetKind, AdThumbKind> = {
  Photo: 'photo',
  Logo: 'offer',
  Video: 'bg',
  Doc: 'product',
};

export function BrandAssetsTab() {
  const { data: assets, loading } = useQuery<Asset[]>((p) => p.listAssets());
  const { data: clients } = useQuery<Client[]>((p) => p.listClients());
  const [filter, setFilter] = useState<Filter>('All clients');

  const clientName = (id: string) =>
    clients?.find((c) => c.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    if (!assets) return [];
    if (filter === 'All clients') return assets;
    if (filter === 'AI-analyzed') return assets.filter((a) => a.analysisStatus === 'Analyzed');
    return assets.filter((a) => a.kind === FILTER_KIND[filter]);
  }, [assets, filter]);

  if (loading) return <div className="meta">Loading…</div>;

  return (
    <div className="stack gap-12">
      <div className="row between">
        <div className="row gap-8">
          <div className="input" style={{ width: 260 }}>
            <Icon name="search" size={13} />
            <span style={{ color: 'var(--fg-2)' }}>Search…</span>
          </div>
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`pill ${on ? 'teal' : ''}`}
                style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
              >
                {on && <span className="dot" />}
                {f}
              </button>
            );
          })}
        </div>
        <button className="btn primary">
          <Icon name="upload" size={13} /> Upload
        </button>
      </div>

      <div className="grid grid-6 gap-8" style={{ gap: 8 }}>
        {filtered.map((a) => (
          <div key={a.id} className="card" style={{ overflow: 'hidden' }}>
            <AdThumb
              seed={parseInt(a.id.replace(/\D/g, ''), 10) || 20}
              brand={clientName(a.clientId)}
              kind={KIND_TO_ADTHUMB[a.kind]}
              headline=""
              h={96}
            />
            <div className="card-pad stack gap-2" style={{ padding: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.name}
              </span>
              <span className="meta" style={{ fontSize: 10 }}>
                {clientName(a.clientId).split(' ')[0]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
