function prng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

type Props = {
  seed?: number;
  w?: number;
  h?: number;
  up?: boolean;
};

export function DeltaSpark({ seed = 1, w = 120, h = 36, up = true }: Props) {
  const r = prng(seed);
  const n = 32;
  const pts = Array.from({ length: n }, (_, i) => {
    const base = up ? i / n : 1 - i / n;
    return base * 0.7 + r() * 0.3;
  });
  const mn = Math.min(...pts);
  const mx = Math.max(...pts);
  const sx = w / (n - 1);
  const yOf = (v: number) => (1 - (v - mn) / (mx - mn || 1)) * (h - 6) + 3;
  const color = up ? 'var(--green)' : 'var(--red)';
  const id = `spk${seed}-${up}`;
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * sx).toFixed(1)},${yOf(p).toFixed(1)}`)
    .join(' ');
  const area = `${d} L${w},${h} L0,${h} Z`;
  const lx = (n - 1) * sx;
  const ly = yOf(pts[n - 1]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} stroke="var(--bg-1)" strokeWidth="1.5" />
    </svg>
  );
}
