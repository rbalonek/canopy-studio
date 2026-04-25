import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Approvals } from '../views/Approvals';
import { AdPerf } from '../views/AdPerf';
import { AdStudio } from '../views/AdStudio';
import { Auth } from '../views/Auth';
import { Billing } from '../views/Billing';
import { Calendar } from '../views/Calendar';
import { Clients } from '../views/Clients';
import { Components } from '../views/Components';
import { Golden } from '../views/Golden';
import { Onboard } from '../views/Onboard';
import { Overview } from '../views/Overview';
import { Placeholder } from '../views/Placeholder';
import { Publish } from '../views/Publish';
import { Reports } from '../views/Reports';
import { Settings } from '../views/Settings';
import { BrandIntelligence } from '../views/brand/BrandIntelligence';
import { ClientDetail } from '../views/client-detail/ClientDetail';
import { ROUTES, type RouteId } from '../routes';
import { useAppState } from './AppState';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const VIEWS: Record<RouteId, () => JSX.Element> = {
  overview: () => <Overview />,
  clients: () => <Clients />,
  'client-detail': () => <ClientDetail />,
  'ad-perf': () => <AdPerf />,
  calendar: () => <Calendar />,
  'ad-studio': () => <AdStudio />,
  brand: () => <BrandIntelligence />,
  approvals: () => <Approvals />,
  publish: () => <Publish />,
  reports: () => <Reports />,
  settings: () => <Settings />,
  billing: () => <Billing />,
  auth: () => <Auth />,
  onboard: () => <Onboard />,
  golden: () => <Golden />,
  components: () => <Components />,
};

type Props = {
  /** URL prefix this shell is mounted at, e.g. "/dev" or "/app". */
  prefix: string;
};

export function AppShell({ prefix }: Props) {
  const { state } = useAppState();
  const { pathname } = useLocation();

  // Determine isFull from the active subpath (handles both ":/dev/auth" and
  // dynamic params like "/dev/clients/acme"). Fall back to false.
  const subpath = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length).replace(/^\//, '')
    : '';
  const activeRoute = ROUTES.find((r) => r.subpath === subpath || matchesParam(r.subpath, subpath));
  const isFull = activeRoute?.full ?? false;

  return (
    <div
      className="shell"
      style={{ ['--side' as string]: state.sidebarCollapsed ? '64px' : '240px' }}
    >
      <Sidebar prefix={prefix} />
      <div className="stack" style={{ overflow: 'hidden', minWidth: 0 }}>
        {!isFull && <Topbar />}
        <main className="shell-main" style={{ flex: 1, overflowY: 'auto' }}>
          <Routes>
            {ROUTES.map((r) => {
              const Element = VIEWS[r.id];
              const element = Element ? <Element /> : (
                <Placeholder title={r.label} note={`Route id: ${r.id}`} />
              );
              if (r.subpath === '') {
                return <Route key={r.id} index element={element} />;
              }
              return <Route key={r.id} path={r.subpath} element={element} />;
            })}
            <Route path="*" element={<Navigate to="" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/** Match a `:param`-bearing subpath like "clients/:id" against a concrete one like "clients/acme". */
function matchesParam(template: string, actual: string): boolean {
  if (!template.includes(':')) return false;
  const t = template.split('/');
  const a = actual.split('/');
  if (t.length !== a.length) return false;
  return t.every((seg, i) => seg.startsWith(':') || seg === a[i]);
}
