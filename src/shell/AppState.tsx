import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Mode } from '../routes';

export type Theme = 'dark' | 'light';
export type Density = 'comfortable' | 'compact';

export type AppState = {
  mode: Mode;
  theme: Theme;
  density: Density;
  ai: boolean;
  grid: boolean;
  sidebarCollapsed: boolean;
};

const DEFAULTS: AppState = {
  mode: 'agency',
  theme: 'dark',
  density: 'comfortable',
  ai: true,
  grid: false,
  sidebarCollapsed: false,
};

const LS_KEY = 'canopy.state.v1';

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppState>) };
  } catch {
    return DEFAULTS;
  }
}

type Ctx = {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
};

const AppStateContext = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  const set = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    document.documentElement.setAttribute('data-theme', state.theme);
    document.body.setAttribute('data-ai', state.ai ? 'on' : 'off');
    document.body.setAttribute('data-density', state.density);
    document.body.setAttribute('data-grid', state.grid ? 'on' : 'off');
  }, [state]);

  return (
    <AppStateContext.Provider value={{ state, set }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): Ctx {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
