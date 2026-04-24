import { useMemo, useState } from 'react';
import { AIBadge } from '../../components/AIBadge';
import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type { Asset, AssetAnalysisStatus, AssetKind } from '../../data/types';

type Filter = 'All' | 'Logos' | 'Photos' | 'Videos' | 'Docs' | 'AI-analyzed';

const FILTERS: Filter[] = ['All', 'Logos', 'Photos', 'Videos', 'Docs', 'AI-analyzed'];

const FILTER_TO_KIND: Record<Exclude<Filter, 'All' | 'AI-analyzed'>, AssetKind> = {
  Logos: 'Logo',
  Photos: 'Photo',
  Videos: 'Video',
  Docs: 'Doc',
};

const STATUS_PILL: Record<AssetAnalysisStatus, string> = {
  Analyzed: 'green',
  Pending: 'amber',
  Failed: 'red',
};

export function AssetsTab({ clientId }: { clientId: string }) {
  const { data: assets, loading } = useQuery<Asset[]>(
    (p) => p.listAssetsForClient(clientId),
    [clientId],
  );

  const [filter, setFilter] = useState<Filter>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!assets) return [];
    if (filter === 'All') return assets;
    if (filter === 'AI-analyzed') return assets.filter((a) => a.analysisStatus === 'Analyzed');
    return assets.filter((a) => a.kind === FILTER_TO_KIND[filter]);
  }, [assets, filter]);

  const selected = selectedId
    ? assets?.find((a) => a.id === selectedId) ?? null
    : (assets?.find((a) => a.analysisSummary) ?? null);

  if (loading) {
    return <div className="meta">Loading…</div>;
  }

  if (!assets || assets.length === 0) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
      >
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="upload" size={32} />
        </div>
        <div className="h2">No assets uploaded yet</div>
        <div className="meta" style={{ maxWidth: 360 }}>
          Upload logos, photos, videos, or brand docs — we'll auto-analyze them so the Ad Studio can reuse them on-brand.
        </div>
        <button className="btn primary">
          <Icon name="upload" size={13} /> Upload
        </button>
      </div>
    );
  }

  return (
    <div className="stack gap-12">
      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <div className="input" style={{ width: 260 }}>
          <Icon name="search" size={13} />
          <span style={{ color: 'var(--fg-2)' }}>Search assets…</span>
        </div>
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pill ${active ? 'teal' : ''}`}
              style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
            >
              {active && <span className="dot" />}
              {f}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button className="btn ghost">
          <Icon name="upload" size={13} /> Upload
        </button>
        <button className="btn ai">
          <Icon name="sparkles" size={13} /> Analyze selected
        </button>
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16 }}>
        {filtered.map((a) => {
          const isSelected = a.id === selectedId;
          return (
            <div
              key={a.id}
              className="card stack"
              style={{
                overflow: 'hidden',
                cursor: 'pointer',
                outline: isSelected ? '1px solid var(--accent)' : undefined,
              }}
              onClick={() => setSelectedId(a.id)}
            >
              <div
                className="ph"
                style={{ height: 120, borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}
              >
                {a.kind}
              </div>
              <div className="card-pad stack gap-4" style={{ padding: 12 }}>
                <div className="row between">
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.name}
                  </span>
                  <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                </div>
                <div className="row between">
                  <span className="meta" style={{ fontSize: 11 }}>
                    {a.sizeLabel} · {a.dateLabel}
                  </span>
                  <span
                    className={`pill ${STATUS_PILL[a.analysisStatus]}`}
                    style={{ padding: '0 6px', fontSize: 10 }}
                  >
                    <span className="dot" />
                    {a.analysisStatus}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected?.analysisSummary && (
        <div className="ai-surface card-pad stack gap-6">
          <div className="row gap-8">
            <AIBadge />
            <span style={{ fontWeight: 500, fontSize: 13 }}>Analysis of {selected.name}</span>
          </div>
          <div className="meta">{selected.analysisSummary}</div>
          <div className="row gap-8">
            <button className="btn sm">Edit analysis</button>
            <button className="btn ghost sm">Use in Ad Studio →</button>
          </div>
        </div>
      )}
    </div>
  );
}
