import { useAppState } from './AppState';

export function Topbar() {
  const { state, set } = useAppState();
  const { mode, theme } = state;

  return (
    <div className="topbar">
      <div className="ws-switch">
        <div className="ws-av">R</div>
        <div className="stack">
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {mode === 'agency' ? 'Redwood Digital' : 'Acme Dental'}
          </div>
          <div className="meta">{mode === 'agency' ? 'Agency workspace' : 'Business workspace'}</div>
        </div>
      </div>

      <div className="search">
        <span>⌕</span>
        <span>Search…</span>
      </div>

      <div className="seg">
        <button className={mode === 'agency' ? 'on' : ''} onClick={() => set({ mode: 'agency' })}>Agency</button>
        <button className={mode === 'business' ? 'on' : ''} onClick={() => set({ mode: 'business' })}>Business</button>
      </div>

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
