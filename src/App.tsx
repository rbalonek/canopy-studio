import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from './shell/AppState';
import { AppShell } from './shell/AppShell';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { supabase } from './auth/supabaseClient';
import { DataProviderProvider } from './data/context';
import { mockDataProvider } from './data/mockProvider';
import type { Workspace } from './data/types';
import { Login } from './views/Login';
import { LiveOnboard } from './views/LiveOnboard';

/**
 * Top-level router.
 *
 *   /           → live entry. Login when signed out, onboarding when no
 *                 workspace yet, signed-in placeholder when workspace
 *                 exists (Step 5 will redirect to /app/<slug>).
 *   /onboard    → onboarding wizard (auth-only).
 *   /dev/*      → design / wireframe reference, no auth, always reads the
 *                 mock provider so the showroom is independent of the live
 *                 schema.
 *   /app/*      → (Step 5) live, auth-gated product, supabase provider
 *                 scoped to the authenticated user's workspace.
 */
export default function App() {
  return (
    <AppStateProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootGate />} />
          <Route path="/onboard" element={<OnboardGate />} />
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

function RootGate() {
  const auth = useAuth();
  if (auth.loading) return <LoadingScreen />;
  if (!auth.user) return <Login />;
  return <PostAuthRouter />;
}

/** Looks up the user's workspaces and routes accordingly. */
function PostAuthRouter() {
  const auth = useAuth();
  const workspaces = useWorkspaces();

  if (workspaces === null) return <LoadingScreen />;
  if (workspaces.length === 0) return <Navigate to="/onboard" replace />;

  // Step 4 placeholder. Step 5 replaces this with <Navigate to={`/app/${workspaces[0].slug}`} />.
  return <SignedInPlaceholder workspaces={workspaces} email={auth.user?.email ?? ''} />;
}

function OnboardGate() {
  const auth = useAuth();
  if (auth.loading) return <LoadingScreen />;
  if (!auth.user) return <Navigate to="/" replace />;
  return <LiveOnboard />;
}

function useWorkspaces(): Workspace[] | null {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  useEffect(() => {
    if (!supabase) {
      setWorkspaces([]);
      return;
    }
    supabase
      .from('workspaces')
      .select('id, name, slug, mode, owner_id')
      .then(({ data }) => {
        setWorkspaces(
          (data ?? []).map((r) => ({
            id: r.id as string,
            name: r.name as string,
            slug: r.slug as string,
            mode: r.mode as Workspace['mode'],
            ownerId: r.owner_id as string,
          })),
        );
      });
  }, []);
  return workspaces;
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

function SignedInPlaceholder({ workspaces, email }: { workspaces: Workspace[]; email: string }) {
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
      <div className="card card-pad stack gap-12" style={{ maxWidth: 480 }}>
        <h2 className="h2">Signed in</h2>
        <div className="meta">
          You're authenticated as <strong>{email}</strong>.
        </div>
        <div className="stack gap-4">
          <div className="meta">Your workspaces</div>
          {workspaces.map((w) => (
            <div
              key={w.id}
              className="row between"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div className="stack gap-2">
                <span style={{ fontWeight: 500 }}>{w.name}</span>
                <span className="meta" style={{ fontSize: 11 }}>
                  /app/{w.slug} · {w.mode}
                </span>
              </div>
              <span className="tag">{w.mode}</span>
            </div>
          ))}
        </div>
        <div className="meta" style={{ fontSize: 12 }}>
          The live /app/* product mounts in Step 5 — that's when these workspaces become an
          actual dashboard instead of a list.
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
