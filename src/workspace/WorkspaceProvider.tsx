import { createContext, useContext, type ReactNode } from 'react';
import type { Workspace } from '../data/types';

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
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace | null {
  return useContext(WorkspaceContext);
}
