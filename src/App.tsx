import { Navigate, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from './shell/AppState';
import { AppShell } from './shell/AppShell';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { DataProviderProvider } from './data/context';
import { mockDataProvider } from './data/mockProvider';
import { Login } from './views/Login';

/**
 * Top-level router.
 *
 *   /         → live entry. Login form when signed out; signed-in landing
 *               placeholder for now (Step 5 will route to /app/<workspace>).
 *   /dev/*    → design / wireframe reference, no auth, always reads the
 *               mock provider so the showroom is independent of the live
 *               schema.
 *   /app/*    → (Step 5) live, auth-gated product, supabase provider
 *               scoped to the authenticated user's workspace.
 */
export default function App() {
  return (
    <AppStateProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootGate />} />
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
      </AuthProvider>
    </AppStateProvider>
  );
}

/** Gates root `/` on auth state. Login form when signed out, placeholder when signed in. */
function RootGate() {
  const auth = useAuth();
  if (auth.loading) return <LoadingScreen />;
  if (!auth.user) return <Login />;
  return <SignedInPlaceholder />;
}

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
        color: 'var(--fg-3)',
      }}
    >
      Loading…
    </div>
  );
}

function SignedInPlaceholder() {
  const auth = useAuth();
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg)',
        color: 'var(--fg)',
        padding: 24,
      }}
    >
      <div className="card card-pad stack gap-12" style={{ maxWidth: 420 }}>
        <h2 className="h2">Signed in</h2>
        <div className="meta">
          You're authenticated as <strong>{auth.user?.email}</strong>. Onboarding and the live
          /app/* product land in the next steps.
        </div>
        <div className="row gap-8">
          <a className="btn" href="/dev">
            Browse design reference
          </a>
          <button className="btn ghost" onClick={() => auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
