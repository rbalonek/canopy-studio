import { useState } from 'react';
import { ProgressBanner } from '../components/ProgressBanner';

const STEPS = [
  'Welcome',
  'Workspace details',
  'Connect Meta',
  'Add client',
  'Invite team',
  'Done',
] as const;

export function Onboard() {
  const [step, setStep] = useState(1);

  return (
    <div className="content wide" style={{ maxWidth: 1100 }}>
      <div className="row between" style={{ marginBottom: 24 }}>
        <div className="row gap-8">
          <div className="logo-mark">C</div>
          <span style={{ fontWeight: 500 }}>CanopyStudio</span>
        </div>
        <a className="meta">Save and finish later →</a>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '220px 1fr', gap: 32 }}>
        <div className="stack gap-4">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div
                key={s}
                className="row gap-10"
                style={{ padding: '8px 0', cursor: 'pointer' }}
                onClick={() => setStep(n)}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    background: active ? 'var(--accent)' : done ? 'var(--bg-3)' : 'var(--bg-1)',
                    color: active ? '#04221F' : 'var(--fg-1)',
                    fontWeight: 600,
                  }}
                >
                  {done ? '✓' : n}
                </div>
                <span
                  style={{ fontSize: 13, color: active ? 'var(--fg)' : 'var(--fg-2)' }}
                >
                  {s}
                </span>
              </div>
            );
          })}
        </div>

        <div className="card card-pad-lg" style={{ padding: 40 }}>
          {step === 1 && <Step1 onNext={() => setStep(2)} />}
          {step === 2 && <Step2 onBack={() => setStep(1)} onNext={() => setStep(3)} />}
          {step === 3 && <Step3 onBack={() => setStep(2)} onNext={() => setStep(4)} />}
          {step === 4 && <Step4 onBack={() => setStep(3)} onNext={() => setStep(5)} />}
          {step === 5 && <Step5 onBack={() => setStep(4)} onNext={() => setStep(6)} />}
          {step === 6 && <Step6 />}
        </div>
      </div>
    </div>
  );
}

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="stack gap-20">
      <h1 className="h0">How will you use CanopyStudio?</h1>
      <div className="meta">This drives how we label things (clients vs locations).</div>
      <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
        <div
          className="card card-pad-lg stack gap-10 bdr-green"
          style={{ padding: 24, cursor: 'pointer', background: 'rgba(6,182,164,0.05)' }}
        >
          <div className="ph" style={{ height: 80 }}>
            🏢🏢🏢 Agency
          </div>
          <div style={{ fontWeight: 500, fontSize: 16 }}>Agency</div>
          <div className="meta">
            We manage many clients. Some of our clients are multi-location.
          </div>
        </div>
        <div className="card card-pad-lg stack gap-10" style={{ padding: 24, cursor: 'pointer' }}>
          <div className="ph" style={{ height: 80 }}>
            🏪 📍📍 Business
          </div>
          <div style={{ fontWeight: 500, fontSize: 16 }}>Single business with locations</div>
          <div className="meta">We run one business with multiple locations.</div>
        </div>
      </div>
      <div className="row between">
        <span />
        <button className="btn primary" onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}

function Step2({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="stack gap-16">
      <h1 className="h0">Workspace details</h1>
      <div className="grid grid-2 gap-16">
        <div className="stack gap-4">
          <span className="meta">Workspace name</span>
          <div className="ph" style={{ height: 40 }}>
            Redwood Digital
          </div>
        </div>
        <div className="stack gap-4">
          <span className="meta">Industry</span>
          <div className="ph" style={{ height: 40 }}>
            Marketing agency
          </div>
        </div>
        <div className="stack gap-4">
          <span className="meta">Primary timezone</span>
          <div className="ph" style={{ height: 40 }}>
            America/Los_Angeles
          </div>
        </div>
        <div className="stack gap-4">
          <span className="meta">Number of clients</span>
          <div className="seg">
            {['1–5', '6–20', '21–50', '50+'].map((b, i) => (
              <button key={b} className={i === 1 ? 'on' : ''}>
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="stack gap-4">
        <span className="meta">Logo</span>
        <div className="ph" style={{ height: 120, borderRadius: 8 }}>
          Drag + drop or browse
        </div>
      </div>
      <div className="row between">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn primary" onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}

function Step3({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const metaSteps = [
    { t: 'Authenticate with Facebook', done: true },
    { t: 'Select Pages', done: true },
    { t: 'Confirm Instagram Business accounts', done: false, on: true },
  ];
  const pages = [
    'Acme Dental — Downtown',
    'Acme Dental — Midtown',
    'Acme Dental — Westside',
  ];
  return (
    <div className="stack gap-16">
      <h1 className="h0">Connect Meta</h1>
      <div className="meta">
        Authorize once per ad account, then we sync performance every hour.
      </div>
      <div className="ph" style={{ height: 140 }}>
        Meta connect illustration
      </div>
      <div className="stack gap-8">
        {metaSteps.map((s, i) => (
          <div
            key={s.t}
            className="row gap-8"
            style={{
              padding: 10,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: s.on ? 'var(--bg-2)' : 'var(--bg-1)',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: s.done ? 'var(--accent)' : 'var(--bg-3)',
                color: '#04221F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
              }}
            >
              {s.done ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 13, flex: 1 }}>{s.t}</span>
            {s.on && <button className="btn primary sm">Continue</button>}
          </div>
        ))}
      </div>
      <div className="meta">
        Discovered <b>3 Pages</b> · <b>2 IG Business accounts</b>. Choose which to import.
      </div>
      <div className="grid grid-3 gap-8">
        {pages.map((n) => (
          <div key={n} className="card card-pad row gap-8">
            <input type="checkbox" defaultChecked />
            <span style={{ fontSize: 13 }}>{n}</span>
          </div>
        ))}
      </div>
      <div className="row between">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="row gap-8">
          <button className="btn ghost" onClick={onNext}>
            Skip for now
          </button>
          <button className="btn primary" onClick={onNext}>
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

function Step4({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const discoveredPages = [
    '/',
    '/about',
    '/services',
    '/services/invisalign',
    '/services/crowns',
    '/locations/downtown',
    '/blog/saturday-hours',
  ];
  return (
    <div className="stack gap-16">
      <h1 className="h0">Bring in a client</h1>
      <div className="grid grid-2 gap-16">
        <div className="stack gap-4">
          <span className="meta">Client name</span>
          <div className="ph" style={{ height: 40 }}>
            Acme Dental
          </div>
        </div>
        <div className="stack gap-4">
          <span className="meta">Industry</span>
          <div className="ph" style={{ height: 40 }}>
            Dental / Healthcare
          </div>
        </div>
        <div className="stack gap-4" style={{ gridColumn: '1/-1' }}>
          <span className="meta">Website URL</span>
          <div className="ph" style={{ height: 40 }}>
            https://acmedental.com
          </div>
        </div>
      </div>
      <label className="row gap-8 meta">
        <input type="checkbox" defaultChecked /> Scrape site now (recommended)
      </label>
      <ProgressBanner label="Discovering pages on acmedental.com" pct={72} eta="~1m" />
      <div className="meta">Found 24 pages — select which to analyze:</div>
      <div className="card" style={{ maxHeight: 140, overflowY: 'auto' }}>
        {discoveredPages.map((p) => (
          <div
            key={p}
            className="row gap-8"
            style={{ padding: 8, borderBottom: '1px solid var(--border)' }}
          >
            <input type="checkbox" defaultChecked />
            <span className="mono" style={{ fontSize: 12 }}>
              {p}
            </span>
          </div>
        ))}
      </div>
      <a className="meta" style={{ color: 'var(--accent)' }}>
        + Add another client
      </a>
      <div className="row between">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn primary" onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}

function Step5({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="stack gap-16">
      <h1 className="h0">Invite your team</h1>
      <div className="meta">
        Your Starter plan includes 3 seats.{' '}
        <a style={{ color: 'var(--accent)' }}>Upgrade for more</a>
      </div>
      <div className="stack gap-8">
        <div
          className="row gap-8"
          style={{
            padding: 8,
            border: '1px solid var(--border)',
            borderRadius: 6,
            flexWrap: 'wrap',
          }}
        >
          <span className="pill">
            maya@redwood.co ·
            <button
              style={{ border: 0, background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer' }}
            >
              ×
            </button>
          </span>
          <span className="pill">
            jamie@redwood.co ·
            <button
              style={{ border: 0, background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer' }}
            >
              ×
            </button>
          </span>
          <span style={{ flex: 1, color: 'var(--fg-3)', fontSize: 13 }}>Add more emails…</span>
        </div>
        <div className="row gap-8">
          <span className="meta">Role:</span>
          <div className="seg">
            <button>Owner</button>
            <button className="on">Admin</button>
            <button>Member</button>
            <button>Viewer</button>
          </div>
        </div>
      </div>
      <div className="row between">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <div className="row gap-8">
          <button className="btn ghost" onClick={onNext}>
            Skip for now
          </button>
          <button className="btn primary" onClick={onNext}>
            Send invites →
          </button>
        </div>
      </div>
    </div>
  );
}

function Step6() {
  const checklist: [string, boolean][] = [
    ['Workspace created', true],
    ['Meta connected', true],
    ['1 client added', true],
    ['Invite teammates', false],
  ];
  return (
    <div className="stack gap-16" style={{ textAlign: 'center', alignItems: 'center' }}>
      <div className="ph" style={{ width: 120, height: 120, borderRadius: 999 }}>
        🎉
      </div>
      <h1 className="h0">You're set up.</h1>
      <div className="meta" style={{ maxWidth: 400 }}>
        Your workspace is ready. Here's where to go next:
      </div>
      <div className="row gap-8">
        <button className="btn primary">Open overview</button>
        <button className="btn">Create your first ad in Ad Studio</button>
        <button className="btn ghost">Import posts from spreadsheet</button>
      </div>
      <div
        className="card card-pad stack gap-6"
        style={{ maxWidth: 420, textAlign: 'left', marginTop: 12 }}
      >
        <div className="row between meta">
          <span>Setup checklist</span>
          <span>{checklist.filter(([, d]) => d).length} of {checklist.length}</span>
        </div>
        {checklist.map(([t, d]) => (
          <div key={t} className="row gap-8">
            <span style={{ color: d ? 'var(--accent)' : 'var(--fg-3)' }}>{d ? '✓' : '○'}</span>
            <span style={{ fontSize: 13, flex: 1 }}>{t}</span>
            {!d && (
              <a className="meta" style={{ color: 'var(--accent)' }}>
                Finish →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
