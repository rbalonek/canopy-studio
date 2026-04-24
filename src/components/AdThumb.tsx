import { BRAND_TINTS } from './LogoDot';

function prng(seed: number) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export type AdThumbKind = 'photo' | 'offer' | 'product' | 'bg';

type Props = {
  seed?: number;
  brand?: string;
  headline?: string;
  kind?: AdThumbKind;
  w?: number | string;
  h?: number | string;
};

export function AdThumb({
  seed = 1,
  brand = 'Acme Dental',
  headline = 'Same-day crowns',
  kind = 'photo',
  w = '100%',
  h = 140,
}: Props) {
  const r = prng(seed);
  const tints = BRAND_TINTS[brand] ?? ['#334155', '#64748b'];
  const angle = 110 + Math.floor(r() * 50);
  const id = `ad${seed}${kind}`;

  return (
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', borderRadius: 6 }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 320 240"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1" gradientTransform={`rotate(${angle} 0.5 0.5)`}>
            <stop offset="0%" stopColor={tints[0]} />
            <stop offset="100%" stopColor={tints[1]} />
          </linearGradient>
          <radialGradient id={`${id}h`} cx="0.3" cy="0.25" r="0.6">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect width="320" height="240" fill={`url(#${id})`} />
        <rect width="320" height="240" fill={`url(#${id}h)`} />
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x="0" y={i * 30 + r() * 8} width="320" height="1" fill="rgba(255,255,255,0.04)" />
        ))}
        {kind === 'photo' && (
          <g>
            <ellipse cx="160" cy="140" rx="52" ry="38" fill="rgba(255,255,255,0.16)" />
            <circle cx="160" cy="95" r="24" fill="rgba(255,255,255,0.22)" />
            <rect x="100" y="170" width="120" height="80" rx="12" fill="rgba(0,0,0,0.18)" />
          </g>
        )}
        {kind === 'product' && (
          <g>
            <circle cx="160" cy="120" r="52" fill="rgba(255,255,255,0.14)" />
            <circle cx="160" cy="120" r="34" fill="rgba(255,255,255,0.22)" />
            <circle cx="160" cy="120" r="18" fill="rgba(255,255,255,0.36)" />
          </g>
        )}
        {kind === 'bg' && (
          <g>
            {Array.from({ length: 6 }).map((_, i) => (
              <circle key={i} cx={r() * 320} cy={r() * 240} r={20 + r() * 60} fill="rgba(255,255,255,0.06)" />
            ))}
          </g>
        )}
        {kind === 'offer' && (
          <g>
            <rect x="32" y="80" width="180" height="14" rx="2" fill="rgba(255,255,255,0.85)" />
            <rect x="32" y="100" width="140" height="14" rx="2" fill="rgba(255,255,255,0.65)" />
            <rect x="32" y="140" width="90" height="22" rx="4" fill="rgba(0,0,0,0.35)" />
          </g>
        )}
      </svg>
      {headline && (
        <div
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 8,
            color: '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            fontSize: 11,
            lineHeight: 1.25,
            fontWeight: 600,
            maxWidth: '85%',
          }}
        >
          {headline}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          fontSize: 9,
          color: 'rgba(255,255,255,0.85)',
          background: 'rgba(0,0,0,0.25)',
          padding: '2px 6px',
          borderRadius: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Sponsored
      </div>
    </div>
  );
}
