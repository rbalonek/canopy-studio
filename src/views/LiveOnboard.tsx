import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';
import type { WorkspaceMode } from '../data/types';

/**
 * Live onboarding wizard. Same visual structure as the /dev/onboard
 * wireframe but with real Supabase writes — it creates a workspace,
 * upserts the user's profile, and (if a client was named) creates the
 * first client. Only mounted at `/onboard` for authed users who don't
 * yet have a workspace; the wireframe `/dev/onboard` stays untouched
 * as the design reference.
 */
const STEPS = ['Welcome', 'Workspace', 'First client', 'Done'] as const;

// Industry isn't asked during onboarding — it'll be auto-inferred from the
// scraped website later. Default everyone to Professional Services until
// the scraper ports over from ad-optimizer / Swimm-Copywriting-API.
const DEFAULT_INDUSTRY = 'Professional Services';

export function LiveOnboard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [mode, setMode] = useState<WorkspaceMode>('agency');
  const [workspaceName, setWorkspaceName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientWebsite, setClientWebsite] = useState('');
  const [hasMultipleLocations, setHasMultipleLocations] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null);

  async function persist() {
    if (!auth.user || !supabase) {
      setError('Auth not ready');
      return false;
    }
    setSubmitting(true);
    setError(null);

    // Re-fetch the session right before the insert. If it doesn't match
    // the validated user (or is missing), we know the stored JWT is dead
    // and should bail rather than hit the server with a doomed insert.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session || sessionData.session.user.id !== auth.user.id) {
      setSubmitting(false);
      await handleStaleSession();
      return false;
    }

    const slug = `${slugify(workspaceName)}-${randomSuffix()}`;

    // 1. Workspace via the create_workspace RPC. It runs SECURITY DEFINER,
    // inserts the workspaces row + workspace_members owner row atomically,
    // and raises 'Not authenticated' if auth.uid() is null server-side.
    const { data: ws, error: wsErr } = await supabase.rpc('create_workspace', {
      p_name: workspaceName.trim(),
      p_slug: slug,
      p_mode: mode,
    });
    if (wsErr || !ws) {
      setSubmitting(false);
      // "Not authenticated" or any RLS rejection means the JWT didn't
      // validate server-side. Sign out and bounce to Login.
      if (
        wsErr?.message?.includes('Not authenticated') ||
        wsErr?.message?.includes('row-level security')
      ) {
        await handleStaleSession();
        return false;
      }
      setError(wsErr?.message ?? 'Failed to create workspace');
      return false;
    }

    // 2. Profile (idempotent — upsert in case it already exists from a
    // prior attempt). Prefer the display name captured at signup
    // (user_metadata.display_name), falling back to the email's
    // local-part for accounts created before that field existed.
    const metaName =
      typeof auth.user.user_metadata?.display_name === 'string'
        ? auth.user.user_metadata.display_name
        : null;
    await supabase.from('profiles').upsert({
      id: auth.user.id,
      display_name: metaName ?? auth.user.email?.split('@')[0] ?? null,
      mode,
    });

    // 3. First client (best-effort; if it fails, we still have the
    // workspace so the user can add clients later).
    let createdClientId: string | null = null;
    if (clientName.trim()) {
      const clientId = `${slugify(clientName)}-${randomSuffix()}`;
      const { error: cErr } = await supabase.from('clients').insert({
        id: clientId,
        name: clientName.trim(),
        industry: DEFAULT_INDUSTRY,
        complete: 0,
        is_parent: hasMultipleLocations,
        website: clientWebsite.trim() || null,
        workspace_id: ws.id,
      });
      if (cErr) {
        console.warn('Failed to create first client:', cErr.message);
      } else {
        createdClientId = clientId;
      }
    }

    // 4. Kick off the website scraper if a URL was provided. Best-effort
    // — failure here doesn't block onboarding completion. The result
    // lands in scraped_pages + scraped_domains for the Brand Intelligence
    // surfaces and the future Ad Studio briefs.
    if (createdClientId && clientWebsite.trim()) {
      setScraping(true);
      try {
        const { data: scrapeData, error: scrapeErr } = await supabase.functions.invoke(
          'scrape-client',
          { body: { client_id: createdClientId, url: clientWebsite.trim() } },
        );
        if (scrapeErr) {
          setScrapeStatus(`Scrape failed: ${scrapeErr.message}`);
        } else if (scrapeData?.ok) {
          setScrapeStatus(
            `Scraped ${scrapeData.pages_scraped} page${
              scrapeData.pages_scraped === 1 ? '' : 's'
            } from ${clientWebsite}`,
          );
        } else {
          setScrapeStatus(scrapeData?.error ?? 'Scrape returned no pages');
        }
      } catch (e) {
        setScrapeStatus(`Scrape failed: ${(e as Error).message}`);
      } finally {
        setScraping(false);
      }
    }

    setSubmitting(false);
    return true;
  }

  async function onFinish() {
    const ok = await persist();
    if (ok) navigate('/');
  }

  async function handleStaleSession() {
    // The JWT in localStorage isn't valid against this Supabase project
    // (most often happens after a local `supabase db reset` wipes
    // auth.users, or when the env URL changed between hosted and local).
    // Sign the user out so RootGate shows Login and they can re-auth.
    await auth.signOut();
    navigate('/');
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
              website={clientWebsite}
              hasMultipleLocations={hasMultipleLocations}
              onName={setClientName}
              onWebsite={setClientWebsite}
              onHasMultipleLocations={setHasMultipleLocations}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <DoneStep
              workspaceName={workspaceName}
              clientName={clientName}
              clientWebsite={clientWebsite}
              submitting={submitting}
              scraping={scraping}
              scrapeStatus={scrapeStatus}
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
  website,
  hasMultipleLocations,
  onName,
  onWebsite,
  onHasMultipleLocations,
  onBack,
  onNext,
}: {
  name: string;
  website: string;
  hasMultipleLocations: boolean;
  onName: (n: string) => void;
  onWebsite: (w: string) => void;
  onHasMultipleLocations: (b: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="stack gap-16">
      <h1 className="h0">Add your first client</h1>
      <div className="meta">
        Optional — you can add clients later from the dashboard. Skip if you'd rather start empty.
      </div>
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
        <span className="meta">Website URL</span>
        <input
          type="url"
          value={website}
          onChange={(e) => onWebsite(e.target.value)}
          placeholder="https://acmedental.com"
          style={inputStyle}
        />
        <span className="meta" style={{ fontSize: 11 }}>
          We'll scrape this to auto-fill brand info and discover pages (scraper integration coming
          next).
        </span>
      </label>
      <label className="row gap-8">
        <input
          type="checkbox"
          checked={hasMultipleLocations}
          onChange={(e) => onHasMultipleLocations(e.target.checked)}
        />
        <span style={{ fontSize: 13 }}>Has multiple locations</span>
      </label>
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
  clientWebsite,
  submitting,
  scraping,
  scrapeStatus,
  error,
  onBack,
  onFinish,
}: {
  workspaceName: string;
  clientName: string;
  clientWebsite: string;
  submitting: boolean;
  scraping: boolean;
  scrapeStatus: string | null;
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
        {clientWebsite.trim() && (
          <>
            {' '}
            We'll scrape <strong>{clientWebsite}</strong> for brand context after finish.
          </>
        )}
      </div>
      {scraping && (
        <div className="banner" style={{ justifyContent: 'center' }}>
          ◌ Scraping {clientWebsite}… this can take 10–20 seconds
        </div>
      )}
      {!scraping && scrapeStatus && (
        <div className="banner" style={{ justifyContent: 'center' }}>
          ✓ {scrapeStatus}
        </div>
      )}
      {error && (
        <div
          className="banner"
          style={{ color: 'var(--danger, #c33)', justifyContent: 'center' }}
        >
          ⚠ {error}
        </div>
      )}
      <div className="row gap-8">
        <button className="btn ghost" disabled={submitting || scraping} onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn primary"
          disabled={submitting || scraping}
          onClick={onFinish}
        >
          {submitting ? 'Creating…' : scraping ? 'Scraping…' : 'Finish'}
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
