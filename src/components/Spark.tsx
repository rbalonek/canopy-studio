type Props = {
  seed?: number;
  w?: number;
  h?: number;
  stroke?: string;
  fill?: string;
};

export function Spark({
  seed = 1,
  w = 60,
  h = 20,
  stroke = 'var(--accent)',
  fill = 'none',
}: Props) {
  const n = 24;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const x =
      Math.sin(seed * 0.37 + i * 0.6) * 0.5 +
      Math.cos(seed * 0.17 + i * 0.3) * 0.3 +
      (i / n) * 0.3 +
      0.5;
    pts.push(x);
  }
  const mn = Math.min(...pts);
  const mx = Math.max(...pts);
  const sx = w / (n - 1);
  const d = pts
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${(i * sx).toFixed(1)},${(
          (1 - (p - mn) / (mx - mn || 1)) * (h - 2) +
          1
        ).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill={fill} stroke={stroke} strokeWidth="1.25" />
    </svg>
  );
}
