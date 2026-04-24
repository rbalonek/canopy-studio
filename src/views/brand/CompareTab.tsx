import { CreativeCadence } from '../../components/CreativeCadence';
import { Swatches } from '../../components/Swatches';
import { useQuery } from '../../data/context';
import type { BrandComparison, ComparisonCell } from '../../data/types';

/** Default comparison client for the BI Compare tab; swap when we have a workspace selector. */
const DEFAULT_CLIENT = 'acme';

export function CompareTab() {
  const { data: cmp, loading } = useQuery<BrandComparison | null>(
    (p) => p.getBrandComparison(DEFAULT_CLIENT),
    [],
  );

  if (loading) return <div className="meta">Loading…</div>;
  if (!cmp) {
    return (
      <div className="card card-pad stack gap-8">
        <span className="h2">No comparison yet</span>
        <span className="meta">Pick competitors to compare against on the Competitors tab.</span>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="row gap-12">
          <div className="row gap-6">
            <span className="meta">You:</span>
            <span className="pill teal">
              <span className="dot" />
              {cmp.selfName}
            </span>
          </div>
          <div className="row gap-6">
            <span className="meta">vs:</span>
            {cmp.competitorDomains.map((d) => (
              <span key={d} className="pill">
                {d}
              </span>
            ))}
            <span className="pill">+ Add</span>
          </div>
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Dimension</th>
            <th>{cmp.selfName}</th>
            {cmp.competitorDomains.map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cmp.rows.map((row) => (
            <tr key={row.dimension}>
              <td style={{ color: 'var(--fg-2)' }}>{row.dimension}</td>
              {row.cells.map((cell, j) => (
                <CellTd key={j} cell={cell} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellTd({ cell }: { cell: ComparisonCell }) {
  if (cell.type === 'palette') {
    return (
      <td>
        <Swatches colors={cell.colors} />
      </td>
    );
  }
  if (cell.type === 'cadence') {
    return (
      <td style={cell.gap ? { position: 'relative' } : undefined}>
        <div className="row gap-8">
          <CreativeCadence seed={cell.seed} weeks={12} h={24} />
          {cell.gap && (
            <span className="pill amber" style={{ fontSize: 10, padding: '0 6px' }}>
              gap
            </span>
          )}
        </div>
      </td>
    );
  }
  return (
    <td style={cell.gap ? { border: '1px solid rgba(245,158,11,0.6)' } : undefined}>
      {cell.value}
      {cell.gap && (
        <div style={{ marginTop: 4 }}>
          <button className="btn ai sm">Draft ad to close gap →</button>
        </div>
      )}
    </td>
  );
}
