import { AIBadge } from '../../components/AIBadge';
import { useQuery } from '../../data/context';
import type { GapAngle } from '../../data/types';

/** Default client for the BI Gaps & Angles tab; swap when we have a workspace selector. */
const DEFAULT_CLIENT = 'acme';

export function GapsAnglesTab() {
  const { data: gaps, loading } = useQuery<GapAngle[]>(
    (p) => p.listGapAnglesForClient(DEFAULT_CLIENT),
    [],
  );

  if (loading) return <div className="meta">Loading…</div>;

  if (!gaps || gaps.length === 0) {
    return (
      <div className="card card-pad stack gap-8">
        <span className="h2">No gaps surfaced yet</span>
        <span className="meta">Claude needs more competitor scans before it can flag positioning gaps.</span>
      </div>
    );
  }

  return (
    <div className="stack gap-12">
      {gaps.map((g) => (
        <div key={g.id} className="ai-surface card-pad row gap-16">
          <div className="stack gap-6" style={{ flex: 1 }}>
            <div className="row gap-8">
              <AIBadge />
              <span style={{ fontWeight: 500 }}>{g.title}</span>
              <span className="pill">{g.confidence}% confidence</span>
            </div>
            <div className="meta">{g.evidence}</div>
          </div>
          <button className="btn ai">Draft ad from this angle →</button>
        </div>
      ))}
    </div>
  );
}
