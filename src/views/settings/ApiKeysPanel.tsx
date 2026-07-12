import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useAuth } from '../../auth/AuthProvider';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { inputStyle } from './shared';

/**
 * Settings → api: bring-your-own provider keys (workspace_api_keys).
 * A workspace key routes that provider's AI calls through the customer's
 * own account, which drops their per-use AI charge to a small platform
 * fee. Owner-only writes (RLS); the key itself is never SELECTed back —
 * only provider + updated_at, mirroring WorkspaceMetaPanel's stance.
 */
const PROVIDERS: { id: 'anthropic' | 'openai' | 'xai'; label: string; hint: string }[] = [
  { id: 'anthropic', label: 'Anthropic', hint: 'sk-ant-…  (Claude — copy, analysis, reports)' },
  { id: 'openai', label: 'OpenAI', hint: 'sk-…  (GPT — collaboration reviewer, images)' },
  { id: 'xai', label: 'xAI', hint: 'xai-…  (Grok — image generation default)' },
];

export function ApiKeysPanel() {
  const workspace = useWorkspace();
  const auth = useAuth();
  const isOwner = !!workspace && workspace.ownerId === auth.user?.id;

  const [saved, setSaved] = useState<Record<string, string>>({}); // provider → updated_at
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) return;
      const { data } = await supabase
        .from('workspace_api_keys')
        .select('provider, updated_at') // never the key itself
        .eq('workspace_id', workspace.id);
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const row of data ?? []) next[row.provider as string] = row.updated_at as string;
      setSaved(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id, bump]);

  if (!workspace) {
    return (
      <div className="card card-pad">
        <span className="meta">API keys are available in the live app.</span>
      </div>
    );
  }

  async function onSave(provider: string) {
    if (!supabase || !workspace) return;
    const key = (drafts[provider] ?? '').trim();
    if (!key) return;
    setBusy(provider);
    setMsg(null);
    const { error } = await supabase.from('workspace_api_keys').upsert(
      {
        workspace_id: workspace.id,
        provider,
        api_key: key,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,provider' },
    );
    setBusy(null);
    if (error) {
      setMsg({
        kind: 'err',
        text: error.message.includes('policy')
          ? 'Only the workspace owner can manage API keys.'
          : error.message,
      });
      return;
    }
    setDrafts((d) => ({ ...d, [provider]: '' }));
    setMsg({ kind: 'ok', text: `${provider} key saved — new AI runs use it immediately.` });
    setBump((b) => b + 1);
  }

  async function onRemove(provider: string) {
    if (!supabase || !workspace) return;
    if (!confirm(`Remove the ${provider} key? AI calls fall back to CanopyStudio's own key (standard pricing).`)) return;
    setBusy(provider);
    setMsg(null);
    const { error } = await supabase
      .from('workspace_api_keys')
      .delete()
      .eq('workspace_id', workspace.id)
      .eq('provider', provider);
    setBusy(null);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    setBump((b) => b + 1);
  }

  return (
    <div className="card card-pad stack gap-12">
      <span className="h2">Your own AI keys</span>
      <span className="meta">
        Connect your own provider accounts to bring down your AI cost: calls made with your key
        are billed by the provider directly to you, and CanopyStudio only charges a small platform
        fee instead of standard AI pricing. Keys are stored server-side, never shown again, and
        only the workspace owner can change them.
      </span>
      {PROVIDERS.map((p) => {
        const savedAt = saved[p.id];
        return (
          <div key={p.id} className="stack gap-4" style={{ paddingTop: 4 }}>
            <div className="row gap-8" style={{ alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</span>
              {savedAt ? (
                <span className="tag" style={{ color: 'var(--accent)' }}>
                  key set · {new Date(savedAt).toLocaleDateString()}
                </span>
              ) : (
                <span className="tag">not set — using CanopyStudio's key</span>
              )}
            </div>
            {isOwner && (
              <div className="row gap-8">
                <input
                  type="password"
                  placeholder={savedAt ? 'Paste a new key to replace' : p.hint}
                  value={drafts[p.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  style={{ ...inputStyle, flex: 1 }}
                  disabled={busy === p.id}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={() => onSave(p.id)}
                  disabled={busy === p.id || !(drafts[p.id] ?? '').trim()}
                >
                  {savedAt ? 'Replace' : 'Save'}
                </button>
                {savedAt && (
                  <button
                    type="button"
                    className="btn danger sm"
                    onClick={() => onRemove(p.id)}
                    disabled={busy === p.id}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {!isOwner && (
        <span className="meta" style={{ fontSize: 11 }}>
          Only the workspace owner can add or change keys.
        </span>
      )}
      {msg && (
        <div
          className="meta"
          style={{ color: msg.kind === 'err' ? 'var(--danger, #c33)' : 'var(--accent)', fontSize: 12 }}
        >
          {msg.kind === 'err' ? '⚠ ' : '✓ '}
          {msg.text}
        </div>
      )}
    </div>
  );
}
