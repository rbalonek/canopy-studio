// CanopyStudio — primitives and shared components
// Each component is lo-fi wireframe; marked with ph (placeholder) and anno (annotation) styles.

const Icon = ({ name, size = 16, stroke = 1.5 }) => {
  const paths = {
    home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V11z',
    users: 'M16 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0zM6 20a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4M20 8a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM18 14a3 3 0 0 1 3 3',
    chart: 'M4 20V8M10 20V4M16 20v-7M22 20H2',
    calendar: 'M3 6h18v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6zM3 6V4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2M8 2v4M16 2v4M3 10h18',
    sparkles: 'M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5L12 3zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z',
    brain: 'M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3v1a3 3 0 0 0 3 3h1V3H9zM14 3a3 3 0 0 1 3 3v1a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3v1a3 3 0 0 1-3 3h-1V3h1z',
    check: 'M4 12l5 5L20 6',
    queue: 'M3 5h18M3 12h18M3 19h12',
    report: 'M5 3h10l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M8 13h8M8 17h5',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    search: 'M21 21l-4.3-4.3M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
    bell: 'M6 8a6 6 0 1 1 12 0c0 6 3 8 3 8H3s3-2 3-8zM10 21a2 2 0 0 0 4 0',
    bolt: 'M13 3L4 14h7l-1 7 9-11h-7l1-7z',
    plus: 'M12 5v14M5 12h14',
    chev: 'M9 6l6 6-6 6',
    chevd: 'M6 9l6 6 6-6',
    close: 'M6 6l12 12M18 6L6 18',
    grid: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
    list: 'M3 6h18M3 12h18M3 18h18',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    panel: 'M3 4h18v16H3zM9 4v16',
    refresh: 'M20 11A8 8 0 1 0 17 18M20 4v6h-6',
    filter: 'M4 4h16l-6 8v6l-4 2v-8L4 4z',
    cmd: 'M7 4a3 3 0 0 0-3 3v3h3zm0 0v16m0 0a3 3 0 0 1-3-3v-3h3m0 0h10m0 0V4m0 0a3 3 0 0 1 3 3v3h-3m0 0v6m0 0a3 3 0 0 0 3 3v-3h-3m-10 0h10',
    upload: 'M12 3v14M7 8l5-5 5 5M4 21h16',
    link: 'M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-2 2M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l2-2',
    image: 'M3 5h18v14H3zM3 16l5-5 5 5 3-3 5 5M16 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    warn: 'M12 3L2 21h20L12 3zM12 10v5M12 18v.01',
    dots: 'M5 12h.01M12 12h.01M19 12h.01',
    drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  };
  const d = paths[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
};

// Delta Badge
const Delta = ({ v, neutral }) => {
  if (neutral || v === 0 || v == null) return <span className="delta flat">— 0%</span>;
  const up = v > 0;
  const n = Math.abs(v).toFixed(1);
  return <span className={`delta ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {n}%</span>;
};

// Sparkline (deterministic from seed)
const Spark = ({ seed = 1, w = 60, h = 20, stroke = 'var(--accent)', fill = 'none' }) => {
  const n = 24;
  const pts = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    x = Math.sin(seed * 0.37 + i * 0.6) * 0.5 + Math.cos(seed * 0.17 + i * 0.3) * 0.3 + (i / n) * 0.3 + 0.5;
    pts.push(x);
  }
  const mn = Math.min(...pts), mx = Math.max(...pts);
  const sx = w / (n - 1);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * sx).toFixed(1)},${((1 - (p - mn) / (mx - mn || 1)) * (h - 2) + 1).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill={fill} stroke={stroke} strokeWidth="1.25" />
    </svg>
  );
};

// KPI Tile
const KPI = ({ label, value, delta, seed, size = 'L', sub }) => (
  <div className="card card-pad stack gap-8">
    <div className="row between">
      <span className="meta">{label}</span>
      {delta != null && <Delta v={delta} />}
    </div>
    <div style={{ fontSize: size === 'L' ? 28 : 22, lineHeight: '36px', fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    <div className="row between">
      <span className="meta" style={{ color: 'var(--fg-3)' }}>{sub || 'vs prior period'}</span>
      {typeof DeltaSpark === 'function'
        ? <DeltaSpark seed={seed} w={90} h={26} up={(delta ?? 1) >= 0} />
        : <Spark seed={seed} w={70} h={22} />}
    </div>
  </div>
);

// Strategy pill
const Strategy = ({ s }) => {
  const map = {
    'Lead Gen': 'teal',
    'Warm-up': 'indigo',
    ATC: 'indigo',
    VC: 'indigo',
    Traffic: 'indigo',
    Video: 'indigo',
    Purchase: 'amber',
  };
  return <span className={`pill ${map[s] || 'gray'}`}><span className="dot" />{s}</span>;
};
const Status = ({ s }) => {
  const map = { Draft: 'gray', Approved: 'teal', Scheduled: 'indigo', Published: 'green', Error: 'red', Paused: 'gray', Active: 'green' };
  return <span className={`pill ${map[s] || 'gray'}`}><span className="dot" />{s}</span>;
};

// AI Badge
const AIBadge = () => <span className="badge-ai">✦ AI</span>;

// Brand completeness ring
const Ring = ({ p = 60, size = 32 }) => (
  <div className="ring-wrap" style={{ width: size, height: size }}>
    <div className="ring" style={{ '--p': p, width: size, height: size, position: 'absolute' }} />
    <div className="ring-inner">{p}</div>
  </div>
);

// Right Drawer
const Drawer = ({ title, onClose, children, footer }) => (
  <>
    <div className="drawer-scrim" onClick={onClose} />
    <div className="drawer">
      <div className="drawer-head">
        <div className="h2">{title}</div>
        <button className="btn ghost sm" onClick={onClose}><Icon name="close" size={14} /></button>
      </div>
      <div className="drawer-body">{children}</div>
      {footer && <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>{footer}</div>}
    </div>
  </>
);

// Progress banner
const ProgressBanner = ({ label, pct = 42, eta = '~4m' }) => (
  <div className="banner ai" style={{ gap: 16 }}>
    <AIBadge />
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 6, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999 }}>
        <div style={{ width: pct + '%', height: '100%', background: 'var(--ai)', borderRadius: 999 }} />
      </div>
    </div>
    <span className="meta">{pct}% · {eta}</span>
    <a className="btn sm ghost" style={{ color: 'var(--ai-2)' }}>Notify me</a>
  </div>
);

// Empty state
const Empty = ({ title, body, cta, icon = 'sparkles' }) => (
  <div className="card card-pad-lg stack gap-12" style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}>
    <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}><Icon name={icon} size={32} /></div>
    <div className="h2">{title}</div>
    <div className="meta" style={{ maxWidth: 360 }}>{body}</div>
    {cta && <button className="btn primary">{cta}</button>}
  </div>
);

// Chart area placeholder — monochrome stacked-area feel
const AreaChart = ({ h = 220, seeds = [1, 2, 3, 4], colors }) => {
  const W = 800, H = h;
  const N = 32;
  const bands = seeds.map((s, idx) => {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const y = Math.sin(s * 0.31 + i * 0.4) * 0.5 + Math.cos(s * 0.19 + i * 0.23) * 0.3 + (idx * 0.18) + 0.5;
      pts.push(y);
    }
    return pts;
  });
  // Stack
  const stacked = [];
  for (let i = 0; i < N; i++) {
    let acc = 0;
    const col = [];
    for (let b = 0; b < bands.length; b++) {
      const v = Math.max(0.05, bands[b][i] * 0.35);
      col.push([acc, acc + v]);
      acc += v;
    }
    stacked.push(col);
  }
  // normalize
  const maxTop = Math.max(...stacked.map(c => c[c.length - 1][1]));
  const sx = W / (N - 1);
  const y = v => H - (v / maxTop) * (H - 20) - 8;
  const palette = colors || ['var(--accent)', 'var(--ai)', '#F59E0B', '#EF4444', '#10B981'];
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {/* grid */}
      {[0.25, 0.5, 0.75].map(p => <line key={p} x1="0" x2={W} y1={H * p} y2={H * p} stroke="var(--border)" strokeDasharray="3 4" />)}
      {bands.map((_, b) => {
        const d1 = stacked.map((c, i) => `${i === 0 ? 'M' : 'L'}${(i * sx).toFixed(1)},${y(c[b][1]).toFixed(1)}`).join(' ');
        const d2 = stacked.slice().reverse().map((c, j) => { const i = N - 1 - j; return `L${(i * sx).toFixed(1)},${y(c[b][0]).toFixed(1)}`; }).join(' ');
        return <path key={b} d={`${d1} ${d2} Z`} fill={palette[b % palette.length]} fillOpacity="0.22" stroke={palette[b % palette.length]} strokeWidth="1.2" />;
      })}
    </svg>
  );
};

// Bar chart placeholder
const Bars = ({ h = 180, n = 14, seed = 2, color = 'var(--accent)' }) => {
  const W = 600, H = h;
  const bw = (W / n) * 0.6, gap = (W / n) * 0.4;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {[0.25, 0.5, 0.75].map(p => <line key={p} x1="0" x2={W} y1={H * p} y2={H * p} stroke="var(--border)" strokeDasharray="3 4" />)}
      {Array.from({ length: n }, (_, i) => {
        const v = Math.abs(Math.sin(seed * 0.3 + i * 0.5)) * 0.8 + 0.15;
        const bh = v * (H - 20);
        return <rect key={i} x={i * (bw + gap) + gap / 2} y={H - bh - 4} width={bw} height={bh} fill={color} opacity="0.7" />;
      })}
    </svg>
  );
};

// Client/Location card
const EntityCard = ({ name, industry, mtd, campaigns, posts, complete, onClick }) => (
  <div className="card card-pad stack gap-12" onClick={onClick} style={{ cursor: 'pointer' }}>
    <div className="row between">
      <div className="row gap-8">
        <div className="logo-mark" style={{ width: 28, height: 28, fontSize: 13 }}>{name.split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
        <div className="stack">
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div className="meta">{industry}</div>
        </div>
      </div>
      <Ring p={complete} />
    </div>
    <div className="row gap-16" style={{ paddingTop: 4 }}>
      <div className="stack"><span className="meta">Spend MTD</span><span style={{ fontWeight: 500 }}>{mtd}</span></div>
      <div className="stack"><span className="meta">Campaigns</span><span style={{ fontWeight: 500 }}>{campaigns}</span></div>
      <div className="stack"><span className="meta">Posts / wk</span><span style={{ fontWeight: 500 }}>{posts}</span></div>
    </div>
  </div>
);

// Export globally
Object.assign(window, {
  Icon, Delta, Spark, KPI, Strategy, Status, AIBadge, Ring, Drawer, ProgressBanner, Empty, AreaChart, Bars, EntityCard,
});
