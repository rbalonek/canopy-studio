import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

/**
 * Editor for a profile doc — the CLAUDE.md-style markdown document the AI
 * pipeline injects into every system prompt (prompts.ts profileBlock).
 * One doc per entity: pass clientId for a client's doc, omit it for the
 * agency/workspace-level doc that applies to all clients. Members can
 * edit (same RLS stance as skills). Live-only; /dev renders a note.
 */
export function ProfileDocEditor({ clientId }: { clientId?: string }) {
  const workspace = useWorkspace();
  const scopeLabel = clientId ? 'client' : 'agency';

  const [docId, setDocId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) {
        setLoading(false);
        return;
      }
      setLoading(true);
      let q = supabase
        .from('profile_docs')
        .select('id, content, updated_at')
        .eq('workspace_id', workspace.id);
      q = clientId ? q.eq('client_id', clientId) : q.is('client_id', null);
      const { data } = await q.maybeSingle();
      if (cancelled) return;
      setDocId((data?.id as string) ?? null);
      setContent((data?.content as string) ?? '');
      setSavedContent((data?.content as string) ?? '');
      setUpdatedAt((data?.updated_at as string) ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id, clientId]);

  if (!workspace) {
    return (
      <div className="card card-pad">
        <span className="meta">Profile docs are available in the live app.</span>
      </div>
    );
  }

  async function onSave() {
    if (!supabase || !workspace) return;
    setSaving(true);
    setMsg(null);
    const now = new Date().toISOString();
    const { data, error } = docId
      ? await supabase
          .from('profile_docs')
          .update({ content, updated_at: now })
          .eq('id', docId)
          .select('id')
      : await supabase
          .from('profile_docs')
          .insert({
            workspace_id: workspace.id,
            client_id: clientId ?? null,
            content,
            updated_at: now,
          })
          .select('id');
    setSaving(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    if (data?.[0]?.id) setDocId(data[0].id as string);
    setSavedContent(content);
    setUpdatedAt(now);
    setMsg({ kind: 'ok', text: 'Saved — the AI sees this on its next run.' });
  }

  const dirty = content !== savedContent;

  return (
    <div className="card card-pad stack gap-10">
      <div className="row gap-8" style={{ alignItems: 'baseline' }}>
        <span className="h2">{clientId ? 'Client profile' : 'Agency profile'}</span>
        {updatedAt && (
          <span className="meta" style={{ fontSize: 11 }}>
            updated {new Date(updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      <span className="meta">
        A standing markdown doc about this {scopeLabel} — positioning, voice, offers, constraints,
        anything the AI should always know. It's injected into every AI task
        {clientId ? ' for this client' : ' across the workspace'}, alongside Skills.
      </span>
      {loading ? (
        <span className="meta">Loading…</span>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          placeholder={
            clientId
              ? '## About this client\n\n- What they sell, to whom, and why they win\n- Seasonal pushes, offers that convert\n- Hard rules (never discount X, always mention Y)'
              : '## About this agency\n\n- Who we are and how we like our copy to sound\n- House rules that apply to every client'
          }
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--fg)',
            padding: '10px 12px',
            font: '13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
            resize: 'vertical',
          }}
          disabled={saving}
        />
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
      <div>
        <button type="button" className="btn primary sm" onClick={onSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </div>
  );
}
