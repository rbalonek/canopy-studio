import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../auth/supabaseClient';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import { useWorkspace } from '../workspace/WorkspaceProvider';

type TabId =
  | 'account'
  | 'workspace'
  | 'team'
  | 'connections'
  | 'billing'
  | 'api'
  | 'notifications'
  | 'excluded accounts';

const TABS: TabId[] = [
  'account',
  'workspace',
  'team',
  'connections',
  'billing',
  'api',
  'notifications',
  'excluded accounts',
];

type FuturePlatform = { name: string; status: string };

const FUTURE_PLATFORMS: FuturePlatform[] = [
  { name: 'Google Ads', status: 'Coming soon' },
  { name: 'TikTok Ads', status: 'Coming soon' },
  { name: 'LinkedIn Ads', status: 'Coming soon' },
];

export function Settings() {
  const [tab, setTab] = useState<TabId>('connections');

  return (
    <div className="content wide">
      <h1 className="h0" style={{ marginBottom: 16 }}>
        Settings
      </h1>
      <div className="grid" style={{ gridTemplateColumns: '200px 1fr', gap: 20 }}>
        <div className="stack gap-4">
          {TABS.map((t) => (
            <div
              key={t}
              className={`nav-item ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
              style={{ textTransform: 'capitalize', cursor: 'pointer' }}
            >
              {t}
            </div>
          ))}
        </div>
        <div>
          {tab === 'connections' ? (
            <ConnectionsTab />
          ) : (
            <Empty title={`${tab} — wireframe`} body="Form-based settings panel following shell conventions." />
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionsTab() {
  return (
    <div className="stack gap-16">
      <WorkspaceMetaPanel />
      <div className="card">
        <div
          className="card-pad row between"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <span className="h2">Other platforms</span>
        </div>
        {FUTURE_PLATFORMS.map((p, i) => (
          <div
            key={p.name}
            className="row between"
            style={{
              padding: 16,
              borderBottom: i < FUTURE_PLATFORMS.length - 1 ? '1px solid var(--border)' : 0,
            }}
          >
            <div className="row gap-12">
              <div className="ph" style={{ width: 36, height: 36 }} />
              <div className="stack">
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span className="meta">{p.status}</span>
              </div>
            </div>
            <button className="btn sm" disabled style={{ opacity: 0.5 }}>
              Notify me
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

type MetaCreds = {
  hasToken: boolean;
  businessManagerId: string | null;
  updatedAt: string | null;
};

function WorkspaceMetaPanel() {
  const workspace = useWorkspace();
  const [creds, setCreds] = useState<MetaCreds | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  async function refresh() {
    if (!supabase || !workspace) {
      setCreds(null);
      return;
    }
    const { data } = await supabase
      .from('workspace_meta_credentials')
      .select('access_token, business_manager_id, updated_at')
      .eq('workspace_id', workspace.id)
      .maybeSingle();
    if (!data) {
      setCreds(null);
      return;
    }
    setCreds({
      hasToken: !!data.access_token,
      businessManagerId: (data.business_manager_id as string | null) ?? null,
      updatedAt: (data.updated_at as string | null) ?? null,
    });
  }

  useEffect(() => {
    setCreds(undefined);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  if (!workspace) return null;
  if (creds === undefined) return <div className="meta">Loading…</div>;

  return (
    <div className="card">
      <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="row gap-12">
          <div className="ph" style={{ width: 36, height: 36 }} />
          <div className="stack">
            <span style={{ fontWeight: 500 }}>Meta (Facebook + Instagram)</span>
            <span className="meta">
              {creds?.hasToken ? (
                <>Workspace token saved · used by all clients</>
              ) : (
                <>Not connected · paste your master access token below</>
              )}
            </span>
          </div>
        </div>
        {creds?.hasToken && !editing && (
          <div className="row gap-8">
            <button className="btn sm" onClick={() => setEditing(true)}>
              <Icon name="link" size={12} /> Update token
            </button>
            <button
              className="btn ghost sm"
              onClick={async () => {
                if (!supabase || !workspace) return;
                if (!confirm('Disconnect workspace Meta credentials? Stored token will be removed.'))
                  return;
                await supabase
                  .from('workspace_meta_credentials')
                  .delete()
                  .eq('workspace_id', workspace.id);
                refresh();
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {(editing || !creds?.hasToken) && (
        <WorkspaceMetaForm
          workspaceId={workspace.id}
          existing={creds}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
          onCancel={creds?.hasToken ? () => setEditing(false) : undefined}
        />
      )}

      {!editing && creds?.hasToken && (
        <div className="card-pad stack gap-8">
          <div className="row gap-16">
            <div className="stack gap-2" style={{ minWidth: 200 }}>
              <span className="meta">Business Manager ID</span>
              <span className="mono" style={{ fontSize: 13 }}>
                {creds.businessManagerId || '—'}
              </span>
            </div>
            <div className="stack gap-2">
              <span className="meta">Access token</span>
              <span style={{ fontSize: 13 }}>•••••••• (stored)</span>
            </div>
          </div>
          <div className="meta" style={{ fontSize: 11 }}>
            Last updated{' '}
            {creds.updatedAt
              ? new Date(creds.updatedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : '—'}
            . The token is stored once at the workspace level and used by the
            Edge Function to call the Meta Graph API on behalf of every client
            in this workspace. Per-client / per-location ad account IDs live
            with each client.
          </div>
        </div>
      )}
    </div>
  );
}

function WorkspaceMetaForm({
  workspaceId,
  existing,
  onSaved,
  onCancel,
}: {
  workspaceId: string;
  existing: MetaCreds | null | undefined;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [accessToken, setAccessToken] = useState('');
  const [bmId, setBmId] = useState(existing?.businessManagerId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError(null);

    const payload: Record<string, unknown> = {
      workspace_id: workspaceId,
      business_manager_id: bmId.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (accessToken.trim()) payload.access_token = accessToken.trim();

    const { error: dbErr } = await supabase
      .from('workspace_meta_credentials')
      .upsert(payload, { onConflict: 'workspace_id' });

    setSubmitting(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    onSaved();
  }

  return (
    <form className="card-pad stack gap-12" onSubmit={onSubmit}>
      <label className="stack gap-4">
        <span className="meta">
          Access token{' '}
          {existing?.hasToken && (
            <span style={{ fontSize: 11 }}>(leave blank to keep existing)</span>
          )}
        </span>
        <input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={existing?.hasToken ? '•••••••••' : 'EAAB...'}
          style={inputStyle}
          autoComplete="off"
          disabled={submitting}
        />
        <span className="meta" style={{ fontSize: 11 }}>
          A long-lived user token or a System User token. System User tokens
          (Business Settings → Users → System Users) don't expire and are the
          recommended option for agency workflows that manage clients
          long-term.
        </span>
      </label>

      <label className="stack gap-4">
        <span className="meta">Business Manager ID (optional)</span>
        <input
          type="text"
          value={bmId}
          onChange={(e) => setBmId(e.target.value)}
          placeholder="1234567890123456"
          style={inputStyle}
          disabled={submitting}
        />
      </label>

      {error && (
        <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
          ⚠ {error}
        </div>
      )}

      <div className="row gap-6">
        <button type="submit" className="btn primary sm" disabled={submitting}>
          {submitting ? 'Saving…' : existing?.hasToken ? 'Save changes' : 'Save connection'}
        </button>
        {onCancel && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
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
