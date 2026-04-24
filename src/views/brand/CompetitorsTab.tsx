import { AdLibraryStrip } from '../../components/AdLibraryStrip';
import { CreativeCadence } from '../../components/CreativeCadence';
import { Donut } from '../../components/Donut';
import { Icon } from '../../components/Icon';
import { LogoDot } from '../../components/LogoDot';
import { useQuery } from '../../data/context';
import type { Competitor } from '../../data/types';

export function BrandCompetitorsTab() {
  const { data: competitors, loading } = useQuery<Competitor[]>((p) => p.listCompetitors());

  if (loading) return <div className="meta">Loading…</div>;
  if (!competitors || competitors.length === 0) {
    return (
      <div className="card card-pad stack gap-8">
        <span className="h2">No competitors tracked yet</span>
        <span className="meta">Add a competitor to start tracking positioning, creative cadence, and SoV.</span>
      </div>
    );
  }

  return (
    <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
      {competitors.map((c, i) => (
        <div key={c.domain} className="ai-surface card-pad stack gap-10">
          <div className="row between">
            <div className="row gap-8">
              <LogoDot name={c.domain} size={28} />
              <div className="stack gap-4">
                <span style={{ fontWeight: 500 }}>{c.domain}</span>
                <span className="meta">
                  {c.industry} · since {c.since}
                </span>
              </div>
            </div>
            <Donut value={c.sov} size={40} stroke={5} color="var(--ai)" label={`${c.sov}%`} />
          </div>
          <AdLibraryStrip seed={i + 3} brand={c.domain} n={4} />
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div className="stack gap-4">
              <span className="meta" style={{ fontSize: 11 }}>
                Creative cadence · 12w
              </span>
              <CreativeCadence seed={c.velocity + i} weeks={12} h={24} />
            </div>
            <div className="stack gap-2" style={{ alignItems: 'flex-end' }}>
              <span className="meta" style={{ fontSize: 11 }}>
                This wk
              </span>
              <span
                style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
              >
                {c.velocity}
                <span className="meta" style={{ fontSize: 10, marginLeft: 2 }}>
                  /wk
                </span>
              </span>
            </div>
          </div>
          <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
            {c.pillars.map((p) => (
              <span key={p} className="tag">
                {p}
              </span>
            ))}
          </div>
          {c.newPageDaysAgo !== null && (
            <div
              className="row gap-8"
              style={{ padding: '6px 8px', borderRadius: 4, background: 'var(--bg-2)', fontSize: 12 }}
            >
              <Icon name="sparkles" size={12} />
              <span>
                New landing page spotted {c.newPageDaysAgo}
                {c.newPageDaysAgo === 1 ? 'd ago' : 'd ago'}
              </span>
            </div>
          )}
          <div className="row gap-8">
            <button className="btn sm">View analysis</button>
            <button className="btn ghost sm">Compare</button>
            <button className="btn ghost sm">Re-scrape</button>
          </div>
        </div>
      ))}
    </div>
  );
}
