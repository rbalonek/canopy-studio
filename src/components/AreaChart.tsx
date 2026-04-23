type Props = {
  h?: number;
  seeds?: number[];
  colors?: string[];
};

const DEFAULT_PALETTE = ['var(--accent)', 'var(--ai)', '#F59E0B', '#EF4444', '#10B981'];

export function AreaChart({ h = 220, seeds = [1, 2, 3, 4], colors }: Props) {
  const W = 800;
  const H = h;
  const N = 32;
  const bands = seeds.map((s, idx) => {
    const pts: number[] = [];
    for (let i = 0; i < N; i++) {
      const y =
        Math.sin(s * 0.31 + i * 0.4) * 0.5 +
        Math.cos(s * 0.19 + i * 0.23) * 0.3 +
        idx * 0.18 +
        0.5;
      pts.push(y);
    }
    return pts;
  });
  const stacked: [number, number][][] = [];
  for (let i = 0; i < N; i++) {
    let acc = 0;
    const col: [number, number][] = [];
    for (let b = 0; b < bands.length; b++) {
      const v = Math.max(0.05, bands[b][i] * 0.35);
      col.push([acc, acc + v]);
      acc += v;
    }
    stacked.push(col);
  }
  const maxTop = Math.max(...stacked.map((c) => c[c.length - 1][1]));
  const sx = W / (N - 1);
  const y = (v: number) => H - (v / maxTop) * (H - 20) - 8;
  const palette = colors ?? DEFAULT_PALETTE;
  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1="0"
          x2={W}
          y1={H * p}
          y2={H * p}
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
      ))}
      {bands.map((_, b) => {
        const d1 = stacked
          .map((c, i) => `${i === 0 ? 'M' : 'L'}${(i * sx).toFixed(1)},${y(c[b][1]).toFixed(1)}`)
          .join(' ');
        const d2 = stacked
          .slice()
          .reverse()
          .map((c, j) => {
            const i = N - 1 - j;
            return `L${(i * sx).toFixed(1)},${y(c[b][0]).toFixed(1)}`;
          })
          .join(' ');
        return (
          <path
            key={b}
            d={`${d1} ${d2} Z`}
            fill={palette[b % palette.length]}
            fillOpacity="0.22"
            stroke={palette[b % palette.length]}
            strokeWidth="1.2"
          />
        );
      })}
    </svg>
  );
}
