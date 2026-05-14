import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppState } from './AppState';

export function Topbar() {
  const { state, set } = useAppState();
  const workspace = useWorkspace();
  const { mode, theme } = state;

  // /app/<slug> has a real workspace — show its name and lock the mode.
  // /dev keeps the wireframe placeholders + the Agency/Business toggle so
  // designers can preview both modes.
  const effectiveMode = workspace?.mode ?? mode;
  const wsName = workspace?.name ?? (mode === 'agency' ? 'Redwood Digital' : 'Acme Dental');
  const wsAvatar = wsName[0]?.toUpperCase() ?? 'R';
  const wsSubtitle = effectiveMode === 'agency' ? 'Agency workspace' : 'Business workspace';

  return (
    <div className="topbar">
      <div className="ws-switch">
        <div className="ws-av">{wsAvatar}</div>
        <div className="stack">
          <div style={{ fontSize: 13, fontWeight: 500 }}>{wsName}</div>
          <div className="meta">{wsSubtitle}</div>
        </div>
      </div>

      <div className="search">
        <span>⌕</span>
        <span>Search…</span>
      </div>

      {!workspace && (
        <div className="seg">
          <button className={mode === 'agency' ? 'on' : ''} onClick={() => set({ mode: 'agency' })}>
            Agency
          </button>
          <button
            className={mode === 'business' ? 'on' : ''}
            onClick={() => set({ mode: 'business' })}
          >
            Business
          </button>
        </div>
      )}

      <button
        className="btn sm ghost"
        onClick={() => set({ theme: theme === 'dark' ? 'light' : 'dark' })}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☾' : '☀'}
      </button>
    </div>
  );
}
