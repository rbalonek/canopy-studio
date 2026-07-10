import { useState, type FormEvent } from 'react';
import { supabase } from '../../auth/supabaseClient';
import type { Mode } from '../../routes';
import { useAppState } from '../../shell/AppState';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { inputStyle } from './shared';

/** Workspace settings: rename + agency/business mode. Owner-only — RLS
 * (workspaces update for owner) makes a non-owner save a no-op, which we
 * detect via the returned row count. The slug is frozen: every /app URL
 * embeds it. Mode also flips the local UI toggle so labels change
 * immediately; the page reloads after save so the shell (topbar, provider)
 * picks up the new name. */
export function WorkspaceTab() {
  const workspace = useWorkspace();
  const { set } = useAppState();

  const [name, setName] = useState(workspace?.name ?? '');
  const [mode, setMode] = useState<Mode>((workspace?.mode as Mode) ?? 'agency');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  if (!workspace) {
    return (
      <div className="card card-pad">
        <span className="meta">Workspace settings are available in the live app.</span>
      </div>
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !workspace) return;
    if (!name.trim()) {
      setMsg({ kind: 'err', text: 'Name can’t be empty.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    const { data, error } = await supabase
      .from('workspaces')
      .update({ name: name.trim(), mode })
      .eq('id', workspace.id)
      .select('id');
    setSaving(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    if (!data || data.length === 0) {
      setMsg({ kind: 'err', text: 'Only the workspace owner can change these settings.' });
      return;
    }
    set({ mode });
    setMsg({ kind: 'ok', text: 'Saved — reloading…' });
    // The workspace object in context is loaded once per page load; reload
    // so the shell shows the new name everywhere.
    window.setTimeout(() => window.location.reload(), 600);
  }

  return (
    <form onSubmit={onSave} className="card card-pad stack gap-10">
      <span className="h2">Workspace</span>
      <label className="stack gap-4">
        <span className="meta">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          disabled={saving}
        />
      </label>
      <label className="stack gap-4">
        <span className="meta">URL slug (fixed — it's part of every link)</span>
        <input
          type="text"
          value={workspace.slug}
          readOnly
          disabled
          style={{ ...inputStyle, opacity: 0.6 }}
        />
      </label>
      <label className="stack gap-4">
        <span className="meta">Mode</span>
        <select
          className="input"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          disabled={saving}
          style={{ ...inputStyle, appearance: 'auto' }}
        >
          <option value="agency">Agency — I manage clients</option>
          <option value="business">Business — I manage my own locations</option>
        </select>
      </label>
      <span className="meta" style={{ fontSize: 11 }}>
        Mode changes labels across the app (Clients ↔ Locations). Your data is unchanged.
      </span>
      {msg && (
        <div
          className="meta"
          style={{
            color: msg.kind === 'err' ? 'var(--danger, #c33)' : 'var(--accent)',
            fontSize: 12,
          }}
        >
          {msg.kind === 'err' ? '⚠ ' : '✓ '}
          {msg.text}
        </div>
      )}
      <div>
        <button type="submit" className="btn primary sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save workspace'}
        </button>
      </div>
    </form>
  );
}
