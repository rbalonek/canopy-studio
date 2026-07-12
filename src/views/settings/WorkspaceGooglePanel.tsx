import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { invokeErrorText } from '../../lib/invokeError';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { inputStyle } from './shared';

/**
 * Settings → Connections: Google Ads. One connection per workspace —
 * the OAuth refresh token lands in workspace_google_credentials via the
 * google-oauth callback; the MCC (manager account) id is stored alongside
 * because the developer token authenticates under it. Which client pulls
 * from which customer id is set per client (Ad Accounts tab).
 */
export function WorkspaceGooglePanel() {
  const workspace = useWorkspace();
  const [connected, setConnected] = useState<{ hasToken: boolean; mcc: string | null; updatedAt: string | null } | null | undefined>(undefined);
  const [mccDraft, setMccDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('google');
    if (!g) return null;
    return g === 'connected'
      ? '✓ Google Ads connected — the refresh token was saved.'
      : `⚠ Google connect failed: ${params.get('reason') ?? 'unknown error'}`;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) {
        setConnected(null);
        return;
      }
      const { data } = await supabase
        .from('workspace_google_credentials')
        .select('refresh_token, login_customer_id, updated_at') // token only truthiness-checked, never displayed
        .eq('workspace_id', workspace.id)
        .maybeSingle();
      if (cancelled) return;
      setConnected(
        data
          ? {
              hasToken: !!data.refresh_token,
              mcc: (data.login_customer_id as string | null) ?? null,
              updatedAt: (data.updated_at as string | null) ?? null,
            }
          : null,
      );
      if (data?.login_customer_id) setMccDraft(data.login_customer_id as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  if (!workspace || connected === undefined) return null;

  async function connect() {
    if (!supabase || !workspace) return;
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.functions.invoke('google-oauth', {
      body: {
        action: 'start',
        workspace_id: workspace.id,
        login_customer_id: mccDraft.trim() || undefined,
        return_to: window.location.href.split('?')[0],
      },
    });
    setBusy(false);
    if (error || !data?.ok || !data?.url) {
      setMsg(`⚠ ${await invokeErrorText(data, error)}`);
      return;
    }
    window.location.href = data.url as string;
  }

  return (
    <div className="card">
      <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="row gap-12">
          <div className="ph" style={{ width: 36, height: 36 }} />
          <div className="stack">
            <span style={{ fontWeight: 500 }}>Google Ads</span>
            <span className="meta">
              {connected?.hasToken
                ? `Connected${connected.mcc ? ` · MCC ${connected.mcc}` : ''} — set each client's customer id on its Ad Accounts tab`
                : 'Reporting-first: connect with Google, then set customer ids per client'}
            </span>
          </div>
        </div>
        {connected?.hasToken && (
          <button className="btn sm" onClick={connect} disabled={busy}>
            {busy ? 'Redirecting…' : 'Reconnect'}
          </button>
        )}
      </div>
      {!connected?.hasToken && (
        <div className="card-pad stack gap-8">
          <label className="stack gap-4" style={{ maxWidth: 320 }}>
            <span className="meta">Manager (MCC) account id — the account your developer token lives under</span>
            <input
              type="text"
              placeholder="123-456-7890"
              value={mccDraft}
              onChange={(e) => setMccDraft(e.target.value)}
              style={inputStyle}
              disabled={busy}
            />
          </label>
          <div>
            <button className="btn primary sm" onClick={connect} disabled={busy}>
              {busy ? 'Redirecting…' : 'Connect with Google'}
            </button>
          </div>
        </div>
      )}
      {msg && (
        <div className="card-pad">
          <span className="meta" style={{ color: msg.startsWith('✓') ? 'var(--accent)' : 'var(--danger, #c33)' }}>
            {msg}
          </span>
        </div>
      )}
    </div>
  );
}
