import { Navigate, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from './shell/AppState';
import { AppShell } from './shell/AppShell';
import { DataProviderProvider } from './data/context';
import { pickProvider } from './data/pickProvider';

const provider = pickProvider();

/**
 * Top-level router.
 *
 *   /         → redirect to /dev (will become the live flow root once auth lands)
 *   /dev/*    → design / wireframe reference, no auth, fixture or local-supabase data
 *   /app/*    → (future) live, auth-gated product mounted by the same AppShell
 */
export default function App() {
  return (
    <AppStateProvider>
      <DataProviderProvider provider={provider}>
        <Routes>
          <Route path="/" element={<Navigate to="/dev" replace />} />
          <Route path="/dev/*" element={<AppShell prefix="/dev" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DataProviderProvider>
    </AppStateProvider>
  );
}
