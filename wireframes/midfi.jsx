// CanopyStudio — mid-fi visual primitives
// AdThumb, LogoDot, LiftBar, DeltaSpark, Histogram, CreativeCadence, AdLibraryThumb

// Deterministic PRNG
const prng = (seed) => {
  let s = seed | 0 || 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
};

// Branded logo mark — colored gradient disc with initials
const BRAND_TINTS = {
  'Acme Dental': ['#2a5f8d', '#0E8A80'],
  'Seaside Yoga': ['#D97757', '#F59E0B'],
  'Northside Auto Group': ['#1f2937', '#3b82f6'],
  'Northside Ford': ['#1e3a8a', '#3b82f6'],
  'Northside Kia': ['#7f1d1d', '#dc2626'],
  'Bloom & Vine Florist': ['#86198f', '#ec4899'],
  'Bloom & Vine': ['#86198f', '#ec4899'],
  'Kettle & Crumb Bakery': ['#78350f', '#d97706'],
  'Kettle & Crumb': ['#78350f', '#d97706'],
  'Harbor Legal Partners': ['#0c4a6e', '#0891b2'],
  'Harbor Legal': ['#0c4a6e', '#0891b2'],
  'Pinecrest Family Dentistry': ['#14532d', '#16a34a'],
  'Lumen Eyecare': ['#312e81', '#818cf8'],
  'Summit Roofing Co.': ['#374151', '#9ca3af'],
};
const LogoDot = ({ name, size = 28, fs }) => {
  const tints = BRAND_TINTS[name] || ['#334155', '#64748b'];
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: `linear-gradient(135deg, ${tints[0]} 0%, ${tints[1]} 100%)`,
      color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fs || Math.round(size * 0.42), fontWeight: 700, letterSpacing: '-0.02em',
      flexShrink: 0, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
    }}>{initials}</div>
  );
};

// Rich sparkline — gradient fill + last-point dot
const DeltaSpark = ({ seed = 1, w = 120, h = 36, up = true }) => {
  const r = prng(seed);
  const n = 32;
  const pts = Array.from({ length: n }, (_, i) => {
    const base = up ? i / n : 1 - i / n;
    return base * 0.7 + r() * 0.3;
  });
  const mn = Math.min(...pts), mx = Math.max(...pts);
  const sx = w / (n - 1);
  const y = v => (1 - (v - mn) / (mx - mn || 1)) * (h - 6) + 3;
  const color = up ? 'var(--green)' : 'var(--red)';
  const id = `spk${seed}-${up}`;
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * sx).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const area = `${d} L${w},${h} L0,${h} Z`;
  const lx = (n - 1) * sx, ly = y(pts[n - 1]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.32" />
        <stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} stroke="var(--bg-1)" strokeWidth="1.5" />
    </svg>
  );
};

// Lift bar — horizontal, value on bar, axis baseline at 0
const LiftBar = ({ value, max = 100, color = 'var(--accent)', w = 160, label }) => {
  const pct = Math.max(0, Math.min(1, Math.abs(value) / max));
  return (
    <div className="stack gap-4" style={{ minWidth: w }}>
      {label && <span className="meta" style={{ fontSize: 11 }}>{label}</span>}
      <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
};

// Ad creative thumbnail — generated SVG, product-adjacent
const AdThumb = ({ seed = 1, brand = 'Acme Dental', headline = 'Same-day crowns', kind = 'photo', w = '100%', h = 140 }) => {
  const r = prng(seed);
  const tints = BRAND_TINTS[brand] || ['#334155', '#64748b'];
  const angle = 110 + Math.floor(r() * 50);
  const id = `ad${seed}${kind}`;
  // kind: photo (warm portrait feel), offer (bold text block), bg (abstract), product (shape)
  return (
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', borderRadius: 6 }}>
      <svg width="100%" height="100%" viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
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
        {/* Texture / noise rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x="0" y={i * 30 + (r() * 8)} width="320" height="1" fill="rgba(255,255,255,0.04)" />
        ))}
        {kind === 'photo' && (
          <g>
            {/* simple silhouetted figure */}
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
      {/* Overlay caption */}
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)', fontSize: 11, lineHeight: 1.25, fontWeight: 600, maxWidth: '85%' }}>
        {headline}
      </div>
      <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.25)', padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sponsored</div>
    </div>
  );
};

// Competitor ad-library mini grid (4 small thumbs)
const AdLibraryStrip = ({ seed = 1, brand, n = 4 }) => {
  const kinds = ['photo', 'offer', 'product', 'bg'];
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${n},1fr)`, gap: 4 }}>
      {Array.from({ length: n }).map((_, i) => (
        <AdThumb key={i} seed={seed * 10 + i} brand={brand} kind={kinds[i % 4]} headline="" h={56} />
      ))}
    </div>
  );
};

// Creative cadence — tiny per-week bar strip
const CreativeCadence = ({ seed = 1, weeks = 12, h = 28 }) => {
  const r = prng(seed);
  const vals = Array.from({ length: weeks }, () => Math.floor(r() * 5) + 1);
  const mx = Math.max(...vals);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: h }}>
      {vals.map((v, i) => (
        <div key={i} style={{ width: 6, height: `${(v / mx) * 100}%`, background: i === weeks - 1 ? 'var(--ai)' : 'var(--accent)', opacity: i === weeks - 1 ? 1 : 0.5, borderRadius: 1 }} />
      ))}
    </div>
  );
};

// Horizontal funnel/histogram — array of {label, value}
const Histogram = ({ data, color = 'var(--accent)', max }) => {
  const mx = max || Math.max(...data.map(d => d.value));
  return (
    <div className="stack gap-6">
      {data.map((d, i) => (
        <div key={i} className="row gap-10" style={{ alignItems: 'center', fontSize: 12 }}>
          <div style={{ width: 130, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
          <div style={{ flex: 1, height: 14, background: 'var(--bg-2)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{ width: `${(d.value / mx) * 100}%`, height: '100%', background: d.color || color, borderRadius: 3 }} />
          </div>
          <div style={{ width: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{d.display || d.value}</div>
        </div>
      ))}
    </div>
  );
};

// Donut — single value as % of 100
const Donut = ({ value = 64, size = 72, stroke = 8, color = 'var(--accent)', track = 'var(--bg-2)', label }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label || `${value}%`}</div>
      </div>
    </div>
  );
};

Object.assign(window, { LogoDot, DeltaSpark, LiftBar, AdThumb, AdLibraryStrip, CreativeCadence, Histogram, Donut, BRAND_TINTS });
