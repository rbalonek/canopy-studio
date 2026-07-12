import { Link, NavLink, Outlet } from 'react-router-dom';
import './legal.css';

/**
 * Public shell for /legal/* — no auth, no workspace, no Supabase. Meta and
 * Google app review require these documents at stable, login-free URLs, so
 * nothing here may depend on session state.
 */
export function LegalLayout() {
  return (
    <div className="legal-shell">
      <header className="legal-header">
        <div className="logo-mark">C</div>
        <Link to="/" style={{ fontWeight: 500, color: 'var(--fg)', textDecoration: 'none' }}>
          CanopyStudio
        </Link>
        <nav className="legal-nav">
          <NavLink to="/legal/privacy" className={({ isActive }) => (isActive ? 'on' : '')}>
            Privacy
          </NavLink>
          <NavLink to="/legal/terms" className={({ isActive }) => (isActive ? 'on' : '')}>
            Terms
          </NavLink>
          <NavLink to="/legal/data-deletion" className={({ isActive }) => (isActive ? 'on' : '')}>
            Data deletion
          </NavLink>
        </nav>
      </header>
      <main className="legal-prose">
        <Outlet />
      </main>
      <footer className="legal-footer">
        <span>© 2026 CanopyStudio</span>
        <Link to="/legal/privacy">Privacy Policy</Link>
        <Link to="/legal/terms">Terms of Service</Link>
        <Link to="/legal/data-deletion">Data Deletion</Link>
      </footer>
    </div>
  );
}
