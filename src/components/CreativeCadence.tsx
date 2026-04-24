function prng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

type Props = {
  seed?: number;
  weeks?: number;
  h?: number;
};

export function CreativeCadence({ seed = 1, weeks = 12, h = 28 }: Props) {
  const r = prng(seed);
  const vals = Array.from({ length: weeks }, () => Math.floor(r() * 5) + 1);
  const mx = Math.max(...vals);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: h }}>
      {vals.map((v, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: `${(v / mx) * 100}%`,
            background: i === weeks - 1 ? 'var(--ai)' : 'var(--accent)',
            opacity: i === weeks - 1 ? 1 : 0.5,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}
