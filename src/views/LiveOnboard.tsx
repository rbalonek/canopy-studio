import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import type { Industry, WorkspaceMode } from '../data/types';

/**
 * Live onboarding wizard. Same visual structure as the /dev/onboard
 * wireframe but with real Supabase writes — it creates a workspace,
 * upserts the user's profile, and (if a client was named) creates the
 * first client. Only mounted at `/onboard` for authed users who don't
 * yet have a workspace; the wireframe `/dev/onboard` stays untouched
 * as the design reference.
 */
const STEPS = ['Welcome', 'Workspace', 'First client', 'Done'] as const;

const INDUSTRIES: Industry[] = [
  'Dental / Healthcare',
  'Fitness / Wellness',
  'Automotive',
  'Retail / E-commerce',
  'Food & Beverage',
  'Professional Services',
  'Optometry',
  'Home Services',
];

export function LiveOnboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [mode, setMode] = useState<WorkspaceMode>('agency');
  const [workspaceName, setWorkspaceName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientIndustry, setClientIndustry] = useState<Industry>('Professional Services');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist() {
    if (!auth.user || !supabase) {
      setError('Auth not ready');
      return false;
    }
    setSubmitting(true);
    setError(null);

    const slug = `${slugify(workspaceName)}-${randomSuffix()}`;

    // 1. Workspace (the trigger adds the owner to workspace_members)
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName.trim(),
        slug,
        mode,
        owner_id: auth.user.id,
      })
      .select()
      .single();
    if (wsErr || !ws) {
      setSubmitting(false);
      setError(wsErr?.message ?? 'Failed to create workspace');
      return false;
    }

    // 2. Profile (idempotent — upsert in case it already exists from a
    // prior attempt). Display name defaults to the email's local-part.
    await supabase.from('profiles').upsert({
      id: auth.user.id,
      display_name: auth.user.email?.split('@')[0] ?? null,
      mode,
    });

    // 3. First client (best-effort; if it fails, we still have the
    // workspace so the user can add clients later).
    if (clientName.trim()) {
      const clientId = `${slugify(clientName)}-${randomSuffix()}`;
      const { error: cErr } = await supabase.from('clients').insert({
        id: clientId,
        name: clientName.trim(),
        industry: clientIndustry,
        complete: 0,
        is_parent: false,
        workspace_id: ws.id,
      });
      if (cErr) {
        console.warn('Failed to create first client:', cErr.message);
      }
    }

    setSubmitting(false);
    return true;
  }

  async function onFinish() {
    const ok = await persist();
    if (ok) navigate('/');
  }

  return (
    <div className="content wide" style={{ maxWidth: 1100, padding: 24 }}>
      <div className="row between" style={{ marginBottom: 24 }}>
        <div className="row gap-8">
          <div className="logo-mark">C</div>
          <span style={{ fontWeight: 500 }}>CanopyStudio</span>
        </div>
        <button className="btn ghost meta" onClick={() => auth.signOut()}>
          Sign out
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '220px 1fr', gap: 32 }}>
        <StepRail current={step} />
        <div className="card card-pad-lg" style={{ padding: 40 }}>
          {step === 1 && (
            <WelcomeStep
              mode={mode}
              onMode={setMode}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <WorkspaceStep
              name={workspaceName}
              onName={setWorkspaceName}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <ClientStep
              name={clientName}
              industry={clientIndustry}
              onName={setClientName}
              onIndustry={setClientIndustry}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <DoneStep
              workspaceName={workspaceName}
              clientName={clientName}
              submitting={submitting}
              error={error}
              onBack={() => setStep(3)}
              onFinish={onFinish}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StepRail({ current }: { current: number }) {
  return (
    <div className="stack gap-4">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const active = current === n;
        const done = current > n;
        return (
          <div
            key={s}
            className="row gap-10"
            style={{ padding: '8px 0', cursor: 'default' }}
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
            <span style={{ fontSize: 13, color: active ? 'var(--fg)' : 'var(--fg-2)' }}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

function WelcomeStep({
  mode,
  onMode,
  onNext,
}: {
  mode: WorkspaceMode;
  onMode: (m: WorkspaceMode) => void;
  onNext: () => void;
}) {
  return (
    <div className="stack gap-20">
      <h1 className="h0">How will you use CanopyStudio?</h1>
      <div className="meta">This drives how we label things (clients vs. locations).</div>
      <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
        <ModeCard
          selected={mode === 'agency'}
          onClick={() => onMode('agency')}
          title="Agency"
          body="We manage many clients. Some clients are multi-location."
          icon="🏢🏢🏢"
        />
        <ModeCard
          selected={mode === 'business'}
          onClick={() => onMode('business')}
          title="Single business with locations"
          body="We run one business with multiple locations."
          icon="🏪 📍📍"
        />
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

function ModeCard({
  selected,
  onClick,
  title,
  body,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  body: string;
  icon: ReactNode;
}) {
  return (
    <div
      className={`card card-pad-lg stack gap-10 ${selected ? 'bdr-green' : ''}`}
      style={{
        padding: 24,
        cursor: 'pointer',
        background: selected ? 'rgba(6,182,164,0.05)' : undefined,
      }}
      onClick={onClick}
    >
      <div className="ph" style={{ height: 80 }}>
        {icon}
      </div>
      <div style={{ fontWeight: 500, fontSize: 16 }}>{title}</div>
      <div className="meta">{body}</div>
    </div>
  );
}

function WorkspaceStep({
  name,
  onName,
  onBack,
  onNext,
}: {
  name: string;
  onName: (n: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canContinue = name.trim().length >= 2;
  return (
    <div className="stack gap-16">
      <h1 className="h0">Workspace details</h1>
      <div className="meta">
        Pick a name your team will recognize. You can rename or invite teammates later.
      </div>
      <label className="stack gap-4" style={{ maxWidth: 480 }}>
        <span className="meta">Workspace name</span>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Redwood Digital"
          style={inputStyle}
        />
      </label>
      <div className="row between">
        <button className="btn ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn primary" disabled={!canContinue} onClick={onNext}>
          Continue →
        </button>
      </div>
    </div>
  );
}

function ClientStep({
  name,
  industry,
  onName,
  onIndustry,
  onBack,
  onNext,
}: {
  name: string;
  industry: Industry;
  onName: (n: string) => void;
  onIndustry: (i: Industry) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="stack gap-16">
      <h1 className="h0">Add your first client</h1>
      <div className="meta">
        Optional — you can add clients later from the dashboard. Skip if you'd rather start empty.
      </div>
      <div className="grid grid-2 gap-16">
        <label className="stack gap-4">
          <span className="meta">Client name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Acme Dental"
            style={inputStyle}
          />
        </label>
        <label className="stack gap-4">
          <span className="meta">Industry</span>
          <select
            value={industry}
            onChange={(e) => onIndustry(e.target.value as Industry)}
            style={inputStyle}
          >
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
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

function DoneStep({
  workspaceName,
  clientName,
  submitting,
  error,
  onBack,
  onFinish,
}: {
  workspaceName: string;
  clientName: string;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="stack gap-16" style={{ textAlign: 'center', alignItems: 'center' }}>
      <div className="ph" style={{ width: 120, height: 120, borderRadius: 999 }}>
        🎉
      </div>
      <h1 className="h0">You're set up.</h1>
      <div className="meta" style={{ maxWidth: 400 }}>
        Workspace <strong>{workspaceName || '(unnamed)'}</strong>
        {clientName.trim() ? (
          <>
            {' '}
            with first client <strong>{clientName}</strong>
          </>
        ) : (
          ''
        )}
        . Hit finish to enter your workspace.
      </div>
      {error && (
        <div
          className="banner"
          style={{ color: 'var(--danger, #c33)', justifyContent: 'center' }}
        >
          ⚠ {error}
        </div>
      )}
      <div className="row gap-8">
        <button className="btn ghost" disabled={submitting} onClick={onBack}>
          ← Back
        </button>
        <button className="btn primary" disabled={submitting} onClick={onFinish}>
          {submitting ? 'Creating…' : 'Finish'}
        </button>
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  padding: '10px 12px',
  font: 'inherit',
};
