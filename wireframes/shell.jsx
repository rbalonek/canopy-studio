// CanopyStudio — App shell: sidebar, topbar, tweaks panel, view router

const NAV = [
  { id: 'components', label: 'Component Library', icon: 'grid', section: 'Design System' },
  { id: 'overview', label: 'Overview', icon: 'home', section: 'Workspace' },
  { id: 'clients', label: 'Clients', labelBiz: 'Locations', icon: 'users' },
  { id: 'client-detail', label: 'Client Detail', labelBiz: 'Location Detail', icon: 'users', nested: true },
  { id: 'ad-perf', label: 'Ad Performance', icon: 'chart' },
  { id: 'calendar', label: 'Content Calendar', icon: 'calendar' },
  { id: 'ad-studio', label: 'Ad Studio', icon: 'sparkles', ai: true },
  { id: 'brand', label: 'Brand Intelligence', icon: 'brain' },
  { id: 'approvals', label: 'Approvals', icon: 'check' },
  { id: 'publish', label: 'Publishing Queue', icon: 'queue' },
  { id: 'reports', label: 'Reports', icon: 'report' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
  { id: 'billing', label: 'Billing Detail', icon: 'report', nested: true },
  { id: 'auth', label: 'Auth Shell', icon: 'link', section: 'Flows' },
  { id: 'onboard', label: 'Onboarding Wizard', icon: 'bolt' },
  { id: 'golden', label: 'Golden-Path Flows', icon: 'sparkles' },
];

const Sidebar = ({ view, setView, collapsed, mode, setCollapsed }) => {
  let sec = null;
  return (
    <aside className={`side ${collapsed ? 'collapsed' : ''}`}>
      <div className="side-head row between">
        {!collapsed && (
          <div className="row gap-8">
            <div className="logo-mark">C</div>
            <div className="stack">
              <div className="big" style={{ fontWeight: 600, fontSize: 13 }}>CanopyStudio</div>
              <div className="meta" style={{ fontSize: 10, lineHeight: 1.2 }}>by Redwood Digital</div>
            </div>
          </div>
        )}
        {collapsed && <div className="logo-mark">C</div>}
        <button className="btn ghost sm" onClick={() => setCollapsed(!collapsed)} style={{ padding: 4 }}>
          <Icon name="panel" size={14} />
        </button>
      </div>
      <div className="side-nav">
        {NAV.map(n => {
          const label = mode === 'business' && n.labelBiz ? n.labelBiz : n.label;
          const header = n.section && n.section !== sec ? (sec = n.section, n.section) : null;
          return (
            <React.Fragment key={n.id}>
              {header && !collapsed && <div className="sec">{header}</div>}
              {header && collapsed && <div style={{ height: 8 }} />}
              <div className={`nav-item ${view === n.id ? 'active' : ''}`} onClick={() => setView(n.id)} title={collapsed ? label : ''}>
                <span className="nav-ic"><Icon name={n.icon} size={16} /></span>
                <span className="nav-label" style={{ flex: 1 }}>{label}</span>
                {n.ai && !collapsed && <span style={{ fontSize: 10, color: 'var(--ai-2)' }}>✦</span>}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {!collapsed && (
        <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
          <div className="row gap-8" style={{ fontSize: 12, color: 'var(--fg-2)' }}>
            <div style={{ width: 24, height: 24, borderRadius: 999, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>JR</div>
            <div className="stack" style={{ flex: 1 }}>
              <div style={{ color: 'var(--fg)' }}>Jordan Reyes</div>
              <div className="meta">Owner · Starter</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

const Topbar = ({ mode, setMode, theme, setTheme }) => {
  const agency = mode === 'agency';
  return (
    <div className="topbar">
      <div className="ws-switch">
        <div className="ws-av">{agency ? 'RD' : 'AC'}</div>
        <div className="stack" style={{ lineHeight: 1.1 }}>
          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{agency ? 'Agency' : 'Business'}</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{agency ? 'Redwood Digital' : 'Acme Dental Group'}</span>
        </div>
        <Icon name="chevd" size={14} />
      </div>
      <div className="search">
        <Icon name="search" size={14} />
        <span style={{ flex: 1, fontSize: 13 }}>Search clients, campaigns, posts…</span>
        <span className="kbd">⌘K</span>
      </div>
      <div className="row gap-8">
        <div className="input" style={{ padding: '4px 10px' }}>
          <Icon name="calendar" size={13} />
          <span style={{ fontSize: 12 }}>MTD · Apr 1–21</span>
          <Icon name="chevd" size={12} />
        </div>
        <button className="btn ghost sm" title="Theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={15} />
        </button>
        <button className="btn ghost sm" style={{ position: 'relative' }}>
          <Icon name="bell" size={15} />
          <span style={{ position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />
        </button>
        <div style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--fg-1)' }}>JR</div>
      </div>
    </div>
  );
};

const TweaksPanel = ({ state, set }) => {
  const [open, setOpen] = React.useState(true);
  if (!open) return (
    <button className="tweaks" style={{ width: 'auto', padding: '8px 12px', bottom: 16 }} onClick={() => setOpen(true)}>
      <span className="row gap-6"><Icon name="gear" size={13} />Tweaks</span>
    </button>
  );
  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <div className="row gap-6" style={{ fontWeight: 500 }}><Icon name="gear" size={13} />Tweaks</div>
        <button className="btn ghost sm" onClick={() => setOpen(false)} style={{ padding: 2 }}><Icon name="close" size={12} /></button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <span className="meta">Mode</span>
          <div className="seg">
            <button className={state.mode === 'agency' ? 'on' : ''} onClick={() => set({ mode: 'agency' })}>Agency</button>
            <button className={state.mode === 'business' ? 'on' : ''} onClick={() => set({ mode: 'business' })}>Business</button>
          </div>
        </div>
        <div className="tweak-row">
          <span className="meta">Theme</span>
          <div className="seg">
            <button className={state.theme === 'dark' ? 'on' : ''} onClick={() => set({ theme: 'dark' })}>Dark</button>
            <button className={state.theme === 'light' ? 'on' : ''} onClick={() => set({ theme: 'light' })}>Light</button>
          </div>
        </div>
        <div className="tweak-row">
          <span className="meta">Sidebar</span>
          <div className="seg">
            <button className={!state.collapsed ? 'on' : ''} onClick={() => set({ collapsed: false })}>240px</button>
            <button className={state.collapsed ? 'on' : ''} onClick={() => set({ collapsed: true })}>64px</button>
          </div>
        </div>
        <div className="tweak-row">
          <span className="meta">Density</span>
          <div className="seg">
            <button className={state.density === 'comfortable' ? 'on' : ''} onClick={() => set({ density: 'comfortable' })}>Comfy</button>
            <button className={state.density === 'compact' ? 'on' : ''} onClick={() => set({ density: 'compact' })}>Compact</button>
          </div>
        </div>
        <div className="tweak-row">
          <span className="meta">AI surfaces</span>
          <div className={`switch ${state.ai ? 'on' : ''}`} onClick={() => set({ ai: !state.ai })} />
        </div>
        <div className="tweak-row">
          <span className="meta">Wireframe grid</span>
          <div className={`switch ${state.grid ? 'on' : ''}`} onClick={() => set({ grid: !state.grid })} />
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Sidebar, Topbar, TweaksPanel, NAV });
