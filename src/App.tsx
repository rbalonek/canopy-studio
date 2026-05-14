import { Navigate, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from './shell/AppState';
import { AppShell } from './shell/AppShell';
import { DataProviderProvider } from './data/context';
import { mockDataProvider } from './data/mockProvider';

/**
 * Top-level router.
 *
 *   /         → redirect to /dev (will become the live flow root once auth lands)
 *   /dev/*    → design / wireframe reference, no auth, always reads the mock
 *               provider so the showroom is independent of the live schema
 *   /app/*    → (future) live, auth-gated product, supabase provider scoped
 *               to the authenticated user's workspace
 */
export default function App() {
  return (
    <AppStateProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dev" replace />} />
        <Route
          path="/dev/*"
          element={
            <DataProviderProvider provider={mockDataProvider}>
              <AppShell prefix="/dev" />
            </DataProviderProvider>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppStateProvider>
  );
}
