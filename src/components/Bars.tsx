type Props = {
  h?: number;
  n?: number;
  seed?: number;
  color?: string;
};

export function Bars({ h = 180, n = 14, seed = 2, color = 'var(--accent)' }: Props) {
  const W = 600;
  const H = h;
  const bw = (W / n) * 0.6;
  const gap = (W / n) * 0.4;
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
      {Array.from({ length: n }, (_, i) => {
        const v = Math.abs(Math.sin(seed * 0.3 + i * 0.5)) * 0.8 + 0.15;
        const bh = v * (H - 20);
        return (
          <rect
            key={i}
            x={i * (bw + gap) + gap / 2}
            y={H - bh - 4}
            width={bw}
            height={bh}
            fill={color}
            opacity="0.7"
          />
        );
      })}
    </svg>
  );
}
