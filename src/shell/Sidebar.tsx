import { NavLink } from 'react-router-dom';
import { ROUTES, type RouteDef } from '../routes';
import { useAppState } from './AppState';

const SECTION_LABELS: Record<RouteDef['section'], string> = {
  main: 'Workspace',
  workspace: 'Marketing',
  admin: 'Admin',
  system: 'System',
};

export function Sidebar() {
  const { state, set } = useAppState();
  const { mode, sidebarCollapsed } = state;

  const visible = ROUTES.filter((r) => !r.full && r.id !== 'client-detail');
  const sections = (['main', 'workspace', 'admin', 'system'] as const).map((sec) => ({
    sec,
    items: visible.filter((r) => r.section === sec),
  }));

  return (
    <aside className={`side ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="side-head">
        <div className="row between">
          <div className="row gap-8">
            <div className="logo-mark">C</div>
            {!sidebarCollapsed && <div className="big" style={{ fontWeight: 600 }}>CanopyStudio</div>}
          </div>
          <button
            className="btn ghost sm"
            onClick={() => set({ sidebarCollapsed: !sidebarCollapsed })}
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>
      </div>
      <nav className="side-nav">
        {sections.map(({ sec, items }) =>
          items.length ? (
            <div key={sec}>
              {!sidebarCollapsed && <div className="sec">{SECTION_LABELS[sec]}</div>}
              {items.map((r) => {
                const label = r.labelByMode?.[mode] ?? r.label;
                return (
                  <NavLink
                    key={r.id}
                    to={r.path}
                    end={r.path === '/'}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-ic">▸</span>
                    {!sidebarCollapsed && <span className="nav-label">{label}</span>}
                  </NavLink>
                );
              })}
            </div>
          ) : null,
        )}
      </nav>
    </aside>
  );
}
