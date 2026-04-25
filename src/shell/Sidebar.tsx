import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ROUTES, SECTION_LABELS, routePath, type SidebarSection } from '../routes';
import { useAppState } from './AppState';

type Props = { prefix: string };

export function Sidebar({ prefix }: Props) {
  const { state, set } = useAppState();
  const { mode, sidebarCollapsed: collapsed } = state;

  let currentSection: SidebarSection | null = null;

  return (
    <aside className={`side ${collapsed ? 'collapsed' : ''}`}>
      <div className="side-head row between">
        {!collapsed ? (
          <div className="row gap-8">
            <div className="logo-mark">C</div>
            <div className="stack">
              <div className="big" style={{ fontWeight: 600, fontSize: 13 }}>CanopyStudio</div>
              <div className="meta" style={{ fontSize: 10, lineHeight: 1.2 }}>by Redwood Digital</div>
            </div>
          </div>
        ) : (
          <div className="logo-mark">C</div>
        )}
        <button
          className="btn ghost sm"
          onClick={() => set({ sidebarCollapsed: !collapsed })}
          style={{ padding: 4 }}
          aria-label="Toggle sidebar"
        >
          <Icon name="panel" size={14} />
        </button>
      </div>

      <div className="side-nav">
        {ROUTES.map((r) => {
          const showHeader = r.section !== currentSection;
          if (showHeader) currentSection = r.section;
          const label = r.labelByMode?.[mode] ?? r.label;
          const target = routePath(prefix, r.navTo ?? r.subpath);
          return (
            <Fragment key={r.id}>
              {showHeader && !collapsed && (
                <div className="sec">{SECTION_LABELS[r.section]}</div>
              )}
              {showHeader && collapsed && <div style={{ height: 8 }} />}
              <NavLink
                to={target}
                end={r.subpath === ''}
                title={collapsed ? label : undefined}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-ic">
                  <Icon name={r.icon} size={16} />
                </span>
                {!collapsed && (
                  <span className="nav-label" style={{ flex: 1 }}>
                    {label}
                  </span>
                )}
                {r.ai && !collapsed && (
                  <span style={{ fontSize: 10, color: 'var(--ai-2)' }}>✦</span>
                )}
              </NavLink>
            </Fragment>
          );
        })}
      </div>

      {!collapsed && (
        <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
          <div className="row gap-8" style={{ fontSize: 12, color: 'var(--fg-2)' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: 'var(--bg-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
              }}
            >
              JR
            </div>
            <div className="stack" style={{ flex: 1 }}>
              <div style={{ color: 'var(--fg)' }}>Jordan Reyes</div>
              <div className="meta">Owner · Starter</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
