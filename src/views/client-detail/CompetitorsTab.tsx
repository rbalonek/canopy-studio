import { AIBadge } from '../../components/AIBadge';
import { Icon } from '../../components/Icon';
import { Spark } from '../../components/Spark';
import { useQuery } from '../../data/context';
import type { Competitor } from '../../data/types';

export function CompetitorsTab({ clientId }: { clientId: string }) {
  const { data: competitors, loading } = useQuery<Competitor[]>(
    (p) => p.listCompetitorsForClient(clientId),
    [clientId],
  );

  if (loading) {
    return <div className="meta">Loading…</div>;
  }

  if (!competitors || competitors.length === 0) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
      >
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="brain" size={32} />
        </div>
        <div className="h2">No competitors tracked yet</div>
        <div className="meta" style={{ maxWidth: 360 }}>
          Paste a competitor URL and we'll discover their sitemap, extract positioning, and surface messaging gaps.
        </div>
        <button className="btn primary">
          <Icon name="plus" size={13} /> Add competitor
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
      {competitors.map((c) => (
        <div key={c.domain} className="ai-surface card-pad stack gap-8">
          <div className="row between">
            <div className="row gap-8">
              <div className="ph" style={{ width: 22, height: 22, borderRadius: 4 }} />
              <span style={{ fontWeight: 500 }}>{c.domain}</span>
            </div>
            <AIBadge />
          </div>
          <div className="meta">
            {c.industry} · tracked since {c.since}
          </div>
          <div className="row between">
            <div className="stack gap-4">
              <span className="meta">Content velocity</span>
              <Spark seed={c.velocity} w={100} h={24} />
            </div>
            <div className="stack gap-4" style={{ alignItems: 'flex-end' }}>
              <span className="meta">SoV vs you</span>
              <span style={{ fontWeight: 500 }}>{c.sov}%</span>
            </div>
          </div>
          <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
            {c.pillars.map((p) => (
              <span key={p} className="tag">
                {p}
              </span>
            ))}
          </div>
          <div className="row gap-8">
            <button className="btn sm">View analysis</button>
            <button className="btn ghost sm">Compare</button>
          </div>
        </div>
      ))}
    </div>
  );
}
