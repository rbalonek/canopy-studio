import { useState, type FormEvent } from 'react';
import { useAuth, type OAuthProvider } from '../auth/AuthProvider';

type Mode = 'login' | 'signup' | 'reset';

const TRUST_TAGS = ['SOC 2 ready', 'Built on Supabase', 'Stripe-secured'];

const OAUTH_PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'azure', label: 'Microsoft' },
  { id: 'apple', label: 'Apple' },
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
          <div className="logo-mark">R</div>
          <span style={{ fontWeight: 500 }}>Redwood Digital Strategies</span>
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
                  By continuing you agree to the Terms and Privacy Policy.
                </div>
              </>
            )}
          </form>
        </div>

        <div className="meta" style={{ fontSize: 11 }}>
          © 2025 Redwood Digital Strategies
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
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ph" style={{ width: 280, height: 280, borderRadius: 16 }}>
            Redwood canopy illustration
            <br />
            with data rings overlay
          </div>
        </div>
        <div className="card card-pad stack gap-8">
          <div className="meta">
            "CanopyStudio replaced four tools in our stack. Our agency saves 12 hours a week on
            reporting."
          </div>
          <div className="row gap-8">
            <div className="ph" style={{ width: 24, height: 24, borderRadius: 999 }} />
            <span className="meta">Maya H. · Redwood</span>
          </div>
        </div>
        <div className="row gap-8" style={{ justifyContent: 'center', marginTop: 16 }}>
          {TRUST_TAGS.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
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
