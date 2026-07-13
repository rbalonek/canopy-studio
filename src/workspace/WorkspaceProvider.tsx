import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { Workspace } from '../data/types';
import { setFavicon } from '../lib/setFavicon';
import { useStaleRefresh } from './useStaleRefresh';

/**
 * Provides the current workspace to components mounted under /app/<slug>.
 * Null on /dev (no workspace) — consumers must handle the null case if
 * they're rendered in both shells (Sidebar, Topbar).
 */
const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  // Kick a background Meta refresh if this workspace's campaign data has
  // gone stale (once per session; reads stay DB-only either way).
  useStaleRefresh(workspace.id);

  // Apply the workspace's own logo as the tab favicon while inside /app;
  // restore the CanopyStudio default on unmount / logo change.
  useEffect(() => {
    setFavicon(workspace.logoUrl);
    return () => setFavicon(null);
  }, [workspace.logoUrl]);

  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace | null {
  return useContext(WorkspaceContext);
}
