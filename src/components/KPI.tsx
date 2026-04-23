import { Delta } from './Delta';
import { DeltaSpark } from './DeltaSpark';

type Props = {
  label: string;
  value: string;
  delta?: number;
  seed?: number;
  size?: 'L' | 'M';
  sub?: string;
};

export function KPI({ label, value, delta, seed, size = 'L', sub }: Props) {
  return (
    <div className="card card-pad stack gap-8">
      <div className="row between">
        <span className="meta">{label}</span>
        {delta != null && <Delta v={delta} />}
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
          {sub ?? 'vs prior period'}
        </span>
        <DeltaSpark seed={seed} w={90} h={26} up={(delta ?? 1) >= 0} />
      </div>
    </div>
  );
}
