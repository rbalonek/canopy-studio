import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppStateProvider, useAppState } from './shell/AppState';
import { Sidebar } from './shell/Sidebar';
import { Topbar } from './shell/Topbar';
import { Placeholder } from './views/Placeholder';
import { ROUTES } from './routes';

function Shell() {
  const { state } = useAppState();
  const { pathname } = useLocation();
  const current = ROUTES.find((r) => r.path === pathname);
  const isFull = current?.full ?? false;

  return (
    <div
      className="shell"
      style={{ ['--side' as string]: state.sidebarCollapsed ? '64px' : '240px' }}
    >
      {!isFull && <Sidebar />}
      <div className="stack" style={{ overflow: 'hidden', minWidth: 0 }}>
        {!isFull && <Topbar />}
        <main className="shell-main" style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            {ROUTES.map((r) => (
              <Route
                key={r.id}
                path={r.path}
                element={<Placeholder title={r.label} note={`Route id: ${r.id}`} />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}
