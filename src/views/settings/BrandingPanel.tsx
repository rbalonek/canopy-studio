import { useRef, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { CanopyMark } from '../../components/CanopyMark';
import { useJobRunner } from '../../data/useJob';
import { setFavicon } from '../../lib/setFavicon';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { inputStyle } from './shared';

const BUCKET = 'workspace-assets';

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

/**
 * Settings → Workspace branding. Two ways to set a workspace's logo (which
 * also becomes the browser-tab favicon inside /app):
 *  1. Upload an image directly (workspace-assets bucket).
 *  2. "Import from your website" — an `agency_analysis` job that reads the
 *     agency's own site and fills the logo, a tagline, and the agency
 *     profile doc below.
 * Both write `workspaces.logo_url` (owner-only via RLS). Live-only.
 */
export function BrandingPanel() {
  const workspace = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(workspace?.logoUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [url, setUrl] = useState('');
  const scrape = useJobRunner<{
    logo_applied?: boolean;
    tagline_applied?: boolean;
    profile_written?: boolean;
    logo_found?: string | null;
  }>();

  if (!workspace) {
    return (
      <div className="card card-pad">
        <span className="meta">Branding is available in the live app.</span>
      </div>
    );
  }
  const ws = workspace;

  async function onPickFile(file: File) {
    if (!supabase) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ kind: 'err', text: 'Pick an image file (PNG, JPG, SVG).' });
      return;
    }
    setBusy(true);
    setMsg(null);
    const path = `${ws.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (up.error) {
      setBusy(false);
      setMsg({ kind: 'err', text: up.error.message });
      return;
    }
    const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await supabase
      .from('workspaces')
      .update({ logo_url: publicUrl })
      .eq('id', ws.id)
      .select('id');
    setBusy(false);
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]); // roll back the orphan
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    if (!data || data.length === 0) {
      await supabase.storage.from(BUCKET).remove([path]);
      setMsg({ kind: 'err', text: 'Only the workspace owner can change branding.' });
      return;
    }
    setLogoUrl(publicUrl);
    setFavicon(publicUrl); // update the tab icon immediately, no reload
    setMsg({ kind: 'ok', text: 'Logo saved — it’s now your tab favicon.' });
  }

  async function onRemove() {
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase
      .from('workspaces')
      .update({ logo_url: null })
      .eq('id', ws.id)
      .select('id');
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    if (!data || data.length === 0) {
      setMsg({ kind: 'err', text: 'Only the workspace owner can change branding.' });
      return;
    }
    setLogoUrl(null);
    setFavicon(null);
    setMsg({ kind: 'ok', text: 'Logo removed — back to the CanopyStudio icon.' });
  }

  async function onScrape() {
    const clean = url.trim();
    if (!clean) {
      setMsg({ kind: 'err', text: 'Enter your website URL first.' });
      return;
    }
    setMsg(null);
    await scrape.start({ type: 'agency_analysis', workspaceId: ws.id, input: { url: clean } });
  }

  const done = scrape.completed && scrape.job?.result;
  const result = scrape.job?.result;

  return (
    <div className="card card-pad stack gap-16">
      <div className="stack gap-4">
        <span className="h2">Branding</span>
        <span className="meta">
          Your logo replaces the CanopyStudio icon in the browser tab across this workspace.
        </span>
      </div>

      {/* Logo + upload */}
      <div className="row gap-16" style={{ alignItems: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Workspace logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <CanopyMark size={40} />
          )}
        </div>
        <div className="stack gap-8">
          <div className="row gap-8">
            <button
              type="button"
              className="btn sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? 'Saving…' : logoUrl ? 'Replace logo' : 'Upload logo'}
            </button>
            {logoUrl && (
              <button type="button" className="btn ghost sm" disabled={busy} onClick={onRemove}>
                Remove
              </button>
            )}
          </div>
          <span className="meta" style={{ fontSize: 11 }}>
            Square PNG or SVG works best as a favicon. Max 50&nbsp;MB.
          </span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPickFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="divider" />

      {/* Import from website */}
      <div className="stack gap-8">
        <span className="h2" style={{ fontSize: 14 }}>
          Import from your website
        </span>
        <span className="meta">
          Reads your agency’s own site and fills your logo, a tagline, and the Agency profile below.
          Existing values are kept — it only fills what’s blank.
        </span>
        <div className="row gap-8">
          <input
            type="url"
            placeholder="https://your-agency.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            disabled={scrape.running}
          />
          <button type="button" className="btn primary sm" onClick={onScrape} disabled={scrape.running}>
            {scrape.running ? 'Reading…' : 'Import'}
          </button>
        </div>
        {scrape.running && (
          <span className="meta" style={{ fontSize: 12 }}>
            {scrape.job?.progress_message ?? 'Reading your site…'}
          </span>
        )}
        {scrape.startError && (
          <span className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 12 }}>
            ⚠ {scrape.startError}
          </span>
        )}
        {scrape.failed && (
          <span className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 12 }}>
            ⚠ {scrape.job?.error ?? 'Import failed.'}
          </span>
        )}
        {done && (
          <div className="stack gap-8">
            <span className="meta" style={{ color: 'var(--accent)', fontSize: 12 }}>
              ✓ Imported{' '}
              {[
                result?.profile_written && 'agency profile',
                result?.logo_applied && 'logo',
                result?.tagline_applied && 'tagline',
              ]
                .filter(Boolean)
                .join(', ') || 'the profile'}
              .{' '}
              {result?.logo_found && !result?.logo_applied
                ? '(You already have a logo, so the scraped one was skipped.)'
                : ''}
            </span>
            <div>
              <button
                type="button"
                className="btn sm"
                onClick={() => window.location.reload()}
              >
                Reload to see changes
              </button>
            </div>
          </div>
        )}
      </div>

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
