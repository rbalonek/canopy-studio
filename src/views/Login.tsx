import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, type OAuthProvider } from '../auth/AuthProvider';
import { CanopyMark } from '../components/CanopyMark';

type Mode = 'login' | 'signup' | 'reset';

// Only providers actually enabled in the Supabase dashboard belong here —
// a listed-but-disabled provider surfaces as an error toast on click.
// Facebook joins once the Meta App Review phase lands.
const OAUTH_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
];

const VALUE_POINTS = [
  {
    title: 'One canopy over every channel',
    body: 'Meta ads, organic Facebook + Instagram, and reporting in one place — per client, per location.',
  },
  {
    title: 'AI that knows the brand',
    body: 'Copy, creative directions, and content calendars grounded in each client’s real website and campaigns.',
  },
  {
    title: 'Approve, then it ships',
    body: 'Posts publish on your say-so; ads are always created paused for a final check in Meta.',
  },
];

/**
 * Live login view. Same hero + side-panel layout as the /dev/auth
 * wireframe, but wired to Supabase auth — signIn / signUp / reset all
 * call real endpoints. Lives at root `/` for unauthenticated visitors.
 */
export function Login() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    if (mode === 'login') {
      const { error } = await auth.signIn(email, password);
      setSubmitting(false);
      if (error) setMessage({ kind: 'error', text: error.message });
      // On success, AuthProvider's onAuthStateChange flips `user`, and
      // the RootGate re-renders us out of the way.
    } else if (mode === 'signup') {
      const { error, needsConfirmation } = await auth.signUp(
        email,
        password,
        displayName.trim() || undefined,
      );
      setSubmitting(false);
      if (error) {
        setMessage({ kind: 'error', text: error.message });
      } else if (needsConfirmation) {
        setMessage({
          kind: 'info',
          text: `Check ${email} for a confirmation link to finish signing up.`,
        });
      }
    } else if (mode === 'reset') {
      const { error } = await auth.resetPassword(email);
      setSubmitting(false);
      if (error) {
        setMessage({ kind: 'error', text: error.message });
      } else {
        setMessage({ kind: 'info', text: `Check ${email} for a reset link.` });
      }
    }
  }

  async function onOAuth(provider: OAuthProvider) {
    setSubmitting(true);
    setMessage(null);
    const { error } = await auth.signInWithOAuth(provider);
    // On success the browser is already navigating to the provider; we
    // only see this path if signInWithOAuth itself rejected (e.g.
    // provider not enabled in the Supabase dashboard).
    if (error) {
      setSubmitting(false);
      setMessage({ kind: 'error', text: error.message });
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '60% 40%',
        background: 'var(--bg)',
      }}
    >
      <div style={{ padding: '48px 64px', display: 'flex', flexDirection: 'column' }}>
        <div className="row gap-8">
          <CanopyMark size={22} title="CanopyStudio" />
          <span style={{ fontWeight: 500 }}>CanopyStudio</span>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            maxWidth: 420,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <CanopyMark size={52} title="CanopyStudio" />
          </div>
          <h1 className="h0" style={{ marginBottom: 6 }}>
            CanopyStudio
          </h1>
          <div className="meta" style={{ marginBottom: 28 }}>
            One canopy over all your paid and organic ads.
          </div>

          <div className="tabs" style={{ marginBottom: 20 }}>
            {(['login', 'signup', 'reset'] as const).map((t) => (
              <div
                key={t}
                className={`tab ${mode === t ? 'on' : ''}`}
                onClick={() => {
                  setMode(t);
                  setMessage(null);
                }}
                style={{ textTransform: 'capitalize', cursor: 'pointer' }}
              >
                {t === 'reset' ? 'Reset password' : t}
              </div>
            ))}
          </div>

          {mode !== 'reset' && (
            <div className="stack gap-10" style={{ marginBottom: 16 }}>
              {OAUTH_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="btn"
                  style={{ justifyContent: 'center', padding: 10 }}
                  onClick={() => onOAuth(p.id)}
                  disabled={submitting}
                >
                  Continue with {p.label}
                </button>
              ))}
              <div className="row gap-8 meta" style={{ margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            </div>
          )}

          <form className="stack gap-10" onSubmit={onSubmit}>
            {mode === 'signup' && (
              <label className="stack gap-4">
                <span className="meta">Full name</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jordan Smith"
                  style={inputStyle}
                  disabled={submitting}
                />
              </label>
            )}
            <label className="stack gap-4">
              <span className="meta">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                disabled={submitting}
              />
            </label>

            {mode !== 'reset' && (
              <label className="stack gap-4">
                <span className="meta">Password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  disabled={submitting}
                />
              </label>
            )}

            {mode === 'login' && (
              <a
                className="meta"
                style={{ textAlign: 'right', color: 'var(--accent)', cursor: 'pointer' }}
                onClick={() => setMode('reset')}
              >
                Forgot password?
              </a>
            )}

            <button
              type="submit"
              className="btn primary"
              style={{ justifyContent: 'center', padding: 10 }}
              disabled={submitting}
            >
              {submitting
                ? 'Working…'
                : mode === 'login'
                  ? 'Log in'
                  : mode === 'signup'
                    ? 'Create account'
                    : 'Send reset link'}
            </button>

            {message && (
              <div
                className="banner"
                style={{
                  justifyContent: 'center',
                  color: message.kind === 'error' ? 'var(--danger, #c33)' : undefined,
                }}
              >
                {message.kind === 'error' ? '⚠ ' : '✓ '}
                {message.text}
              </div>
            )}

            {mode === 'login' && (
              <div className="meta" style={{ textAlign: 'center' }}>
                New here?{' '}
                <a
                  style={{ color: 'var(--accent)', cursor: 'pointer' }}
                  onClick={() => setMode('signup')}
                >
                  Create an account
                </a>
              </div>
            )}
            {mode === 'signup' && (
              <>
                <div className="meta" style={{ textAlign: 'center' }}>
                  Already have an account?{' '}
                  <a
                    style={{ color: 'var(--accent)', cursor: 'pointer' }}
                    onClick={() => setMode('login')}
                  >
                    Log in
                  </a>
                </div>
                <div
                  className="meta"
                  style={{ fontSize: 11, textAlign: 'center', color: 'var(--fg-3)' }}
                >
                  By continuing you agree to the{' '}
                  <Link to="/legal/terms" style={{ color: 'var(--accent)' }}>
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/legal/privacy" style={{ color: 'var(--accent)' }}>
                    Privacy Policy
                  </Link>
                  .
                </div>
              </>
            )}
          </form>
        </div>

        <div className="row gap-12 meta" style={{ fontSize: 11 }}>
          <span>© 2026 CanopyStudio</span>
          <Link to="/legal/privacy" style={{ color: 'var(--fg-3)' }}>
            Privacy
          </Link>
          <Link to="/legal/terms" style={{ color: 'var(--fg-3)' }}>
            Terms
          </Link>
        </div>
      </div>

      <div
        style={{
          background: 'linear-gradient(180deg, var(--bg-1) 0%, rgba(6,182,164,0.12) 100%)',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 16,
            maxWidth: 360,
            margin: '0 auto',
          }}
        >
          {VALUE_POINTS.map((v) => (
            <div key={v.title} className="card card-pad stack gap-4">
              <div style={{ fontWeight: 600, fontSize: 13 }}>{v.title}</div>
              <div className="meta">{v.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  padding: '10px 12px',
  font: 'inherit',
};
