import { Delta } from './Delta';
import { DeltaSpark } from './DeltaSpark';

type Props = {
  label: string;
  value: string;
  delta?: number;
  seed?: number;
  size?: 'L' | 'M';
  sub?: string;
  /** When true, suppress the fake delta + sparkline and show an honest
   * "no data yet" footer instead. Use when there's no historical
   * comparison series available. */
  noData?: boolean;
};

export function KPI({ label, value, delta, seed, size = 'L', sub, noData }: Props) {
  return (
    <div className="card card-pad stack gap-8">
      <div className="row between">
        <span className="meta">{label}</span>
        {!noData && delta != null && <Delta v={delta} />}
      </div>
      <div
        style={{
          fontSize: size === 'L' ? 28 : 22,
          lineHeight: '36px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div className="row between">
        <span className="meta" style={{ color: 'var(--fg-3)' }}>
          {noData ? 'No prior data to compare' : (sub ?? 'vs prior period')}
        </span>
        {!noData && <DeltaSpark seed={seed} w={90} h={26} up={(delta ?? 1) >= 0} />}
      </div>
    </div>
  );
}
