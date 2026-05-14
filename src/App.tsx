import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppStateProvider, useAppState } from './shell/AppState';
import { AppShell } from './shell/AppShell';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { supabase } from './auth/supabaseClient';
import { DataProviderProvider } from './data/context';
import { mockDataProvider } from './data/mockProvider';
import { getSupabaseProvider } from './data/supabaseProvider';
import type { Workspace } from './data/types';
import { Login } from './views/Login';
import { LiveOnboard } from './views/LiveOnboard';
import { WorkspaceProvider } from './workspace/WorkspaceProvider';

/**
 * Top-level router.
 *
 *   /              → live entry. Login when signed out, onboarding when
 *                    no workspace yet, redirect to /app/<slug> when one
 *                    exists.
 *   /onboard       → onboarding wizard (auth-only).
 *   /app/:slug/*   → the live, auth-gated product dashboard. Supabase
 *                    data provider, RLS-scoped to the user's workspace.
 *   /dev/*         → design reference, no auth, mock provider. Untouched
 *                    from the wireframe import.
 */
export default function App() {
  return (
    <AppStateProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootGate />} />
          <Route path="/onboard" element={<OnboardGate />} />
          <Route path="/app/:slug/*" element={<AppGate />} />
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

/** Authed: look up the user's workspaces, route to onboarding or the first one. */
function PostAuthRouter() {
  const workspaces = useWorkspaces();
  if (workspaces === null) return <LoadingScreen />;
  if (workspaces.length === 0) return <Navigate to="/onboard" replace />;
  return <Navigate to={`/app/${workspaces[0].slug}`} replace />;
}

function OnboardGate() {
  const auth = useAuth();
  if (auth.loading) return <LoadingScreen />;
  if (!auth.user) return <Navigate to="/" replace />;
  return <LiveOnboard />;
}

/** /app/:slug/* — auth-gate, look up the workspace, hand off to AppShell. */
function AppGate() {
  const auth = useAuth();
  const { slug } = useParams();
  const workspaces = useWorkspaces();
  const { set: setAppState } = useAppState();

  const workspace = workspaces?.find((w) => w.slug === slug);

  // Sync the workspace's mode into AppState so view-level `mode` reads
  // (sidebar labels, Overview "All clients/locations") stay consistent
  // with the workspace.
  useEffect(() => {
    if (workspace) setAppState({ mode: workspace.mode });
  }, [workspace?.id, workspace?.mode, setAppState]);

  if (auth.loading) return <LoadingScreen />;
  if (!auth.user) return <Navigate to="/" replace />;
  if (!slug) return <Navigate to="/" replace />;
  if (workspaces === null) return <LoadingScreen />;
  if (!workspace) return <Navigate to="/" replace />;

  return (
    <WorkspaceProvider workspace={workspace}>
      <DataProviderProvider provider={getSupabaseProvider()}>
        <AppShell prefix={`/app/${slug}`} />
      </DataProviderProvider>
    </WorkspaceProvider>
  );
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
