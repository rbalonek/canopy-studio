import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppStateProvider, useAppState } from './shell/AppState';
import { Sidebar } from './shell/Sidebar';
import { Topbar } from './shell/Topbar';
import { DataProviderProvider } from './data/context';
import { Placeholder } from './views/Placeholder';
import { Overview } from './views/Overview';
import { Clients } from './views/Clients';
import { ClientDetail } from './views/client-detail/ClientDetail';
import { AdPerf } from './views/AdPerf';
import { AdStudio } from './views/AdStudio';
import { BrandIntelligence } from './views/brand/BrandIntelligence';
import { Calendar } from './views/Calendar';
import { Approvals } from './views/Approvals';
import { Publish } from './views/Publish';
import { Reports } from './views/Reports';
import { Settings } from './views/Settings';
import { Billing } from './views/Billing';
import { Auth } from './views/Auth';
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
      <Sidebar />
      <div className="stack" style={{ overflow: 'hidden', minWidth: 0 }}>
        {!isFull && <Topbar />}
        <main className="shell-main" style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            {ROUTES.map((r) => {
              const element =
                r.id === 'overview' ? (
                  <Overview />
                ) : r.id === 'clients' ? (
                  <Clients />
                ) : r.id === 'client-detail' ? (
                  <ClientDetail />
                ) : r.id === 'ad-perf' ? (
                  <AdPerf />
                ) : r.id === 'ad-studio' ? (
                  <AdStudio />
                ) : r.id === 'brand' ? (
                  <BrandIntelligence />
                ) : r.id === 'calendar' ? (
                  <Calendar />
                ) : r.id === 'approvals' ? (
                  <Approvals />
                ) : r.id === 'publish' ? (
                  <Publish />
                ) : r.id === 'reports' ? (
                  <Reports />
                ) : r.id === 'settings' ? (
                  <Settings />
                ) : r.id === 'billing' ? (
                  <Billing />
                ) : r.id === 'auth' ? (
                  <Auth />
                ) : (
                  <Placeholder title={r.label} note={`Route id: ${r.id}`} />
                );
              return <Route key={r.id} path={r.path} element={element} />;
            })}
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
      <DataProviderProvider>
        <Shell />
      </DataProviderProvider>
    </AppStateProvider>
  );
}
