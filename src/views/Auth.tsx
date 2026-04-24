import { useState } from 'react';

type Mode = 'signup' | 'login' | 'reset' | 'verify';

const MODES: Mode[] = ['signup', 'login', 'reset', 'verify'];

const OAUTH_PROVIDERS = ['Google', 'Microsoft', 'Apple'] as const;

const TRUST_TAGS = ['SOC 2 ready', 'Built on Supabase', 'Stripe-secured'];

export function Auth() {
  const [mode, setMode] = useState<Mode>('signup');

  return (
    <div
      style={{
        position: 'relative',
        margin: -24,
        minHeight: 'calc(100vh - 56px)',
        display: 'grid',
        gridTemplateColumns: '60% 40%',
      }}
    >
      <div
        style={{ background: 'var(--bg)', padding: '48px 64px', display: 'flex', flexDirection: 'column' }}
      >
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
            {MODES.map((t) => (
              <div
                key={t}
                className={`tab ${mode === t ? 'on' : ''}`}
                onClick={() => setMode(t)}
                style={{ textTransform: 'capitalize' }}
              >
                {t}
              </div>
            ))}
          </div>

          {(mode === 'signup' || mode === 'login') && (
            <div className="stack gap-10">
              {OAUTH_PROVIDERS.map((p) => (
                <button
                  key={p}
                  className="btn"
                  style={{ justifyContent: 'center', padding: 10 }}
                >
                  Continue with {p}
                </button>
              ))}
              <div className="row gap-8 meta" style={{ margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div className="ph" style={{ height: 40 }}>
                Email
              </div>
              <div className="ph" style={{ height: 40 }}>
                Password
              </div>
              {mode === 'signup' ? (
                <>
                  <label className="row gap-6 meta">
                    <input type="checkbox" /> Email me a sign-in link instead
                  </label>
                  <button className="btn primary" style={{ justifyContent: 'center', padding: 10 }}>
                    Create account
                  </button>
                  <div className="meta" style={{ textAlign: 'center' }}>
                    Already have an account?{' '}
                    <a style={{ color: 'var(--accent)' }} onClick={() => setMode('login')}>
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
              ) : (
                <>
                  <a
                    className="meta"
                    style={{ textAlign: 'right', color: 'var(--accent)' }}
                    onClick={() => setMode('reset')}
                  >
                    Forgot password?
                  </a>
                  <button className="btn primary" style={{ justifyContent: 'center', padding: 10 }}>
                    Log in
                  </button>
                  <div className="meta" style={{ textAlign: 'center' }}>
                    New here?{' '}
                    <a style={{ color: 'var(--accent)' }} onClick={() => setMode('signup')}>
                      Create an account
                    </a>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'reset' && (
            <div className="stack gap-12">
              <div className="meta">We'll email you a reset link.</div>
              <div className="ph" style={{ height: 40 }}>
                Email
              </div>
              <button className="btn primary" style={{ justifyContent: 'center', padding: 10 }}>
                Send reset link
              </button>
              <div className="banner" style={{ justifyContent: 'center' }}>
                ✓ Check your inbox for a reset link
              </div>
            </div>
          )}

          {mode === 'verify' && (
            <div className="stack gap-12" style={{ textAlign: 'center' }}>
              <div
                className="ph"
                style={{ height: 120, width: 120, borderRadius: 16, margin: '0 auto' }}
              >
                📬
              </div>
              <div className="h2">Check your email</div>
              <div className="meta">
                We sent a link to{' '}
                <span style={{ color: 'var(--fg)' }}>jordan@redwood.co</span>. Click it to finish
                signing in.
              </div>
              <button className="btn ghost">Resend in 0:42</button>
              <div className="banner ai" style={{ justifyContent: 'center' }}>
                ◌ Completing sign-in... (OAuth redirect loading state)
              </div>
            </div>
          )}
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
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
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
          <div className="row gap-4" style={{ justifyContent: 'center' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 18,
                  height: 2,
                  background: i === 0 ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
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
