import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { AIBadge } from '../../components/AIBadge';
import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type { Asset, AssetAnalysisStatus, AssetKind } from '../../data/types';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

type Filter = 'All' | 'Logos' | 'Photos' | 'Videos' | 'Docs' | 'AI-analyzed';

const FILTERS: Filter[] = ['All', 'Logos', 'Photos', 'Videos', 'Docs', 'AI-analyzed'];

const FILTER_TO_KIND: Record<Exclude<Filter, 'All' | 'AI-analyzed'>, AssetKind> = {
  Logos: 'Logo',
  Photos: 'Photo',
  Videos: 'Video',
  Docs: 'Doc',
};

const STATUS_PILL: Record<AssetAnalysisStatus, string> = {
  Analyzed: 'green',
  Pending: 'amber',
  Failed: 'red',
};

/** Live (workspace) → real upload-backed library; /dev → wireframe on mock. */
export function AssetsTab({ clientId }: { clientId: string }) {
  const workspace = useWorkspace();
  if (workspace) return <LiveAssetsTab clientId={clientId} />;
  return <WireframeAssetsTab clientId={clientId} />;
}

// ---------------------------------------------------------------------------
// Live implementation — Supabase Storage (public `client-assets` bucket) + the
// `assets` table. Uploads go straight from the browser; "Set as client logo"
// writes brand_profiles.logo_url and flags edited_fields so a re-analysis
// (website scrape) never overwrites the chosen logo.
// ---------------------------------------------------------------------------

const BUCKET = 'client-assets';

type AssetRow = {
  id: string;
  name: string;
  kind: AssetKind;
  storage_path: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  analysis_status: AssetAnalysisStatus;
  analysis_summary: string | null;
  created_at: string;
};

function inferKind(mime: string): AssetKind {
  if (mime.startsWith('image/')) return 'Photo';
  if (mime.startsWith('video/')) return 'Video';
  return 'Doc';
}
function isImage(a: AssetRow): boolean {
  return (a.mime_type ?? '').startsWith('image/') || a.kind === 'Logo' || a.kind === 'Photo';
}
function sizeLabel(bytes: number | null): string {
  if (!bytes) return '';
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}
function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
/** Keep a storage-safe filename; the uuid prefix guarantees uniqueness. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
}

function LiveAssetsTab({ clientId }: { clientId: string }) {
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Filter>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setAssets([]);
      return;
    }
    const [aRes, bRes] = await Promise.all([
      supabase
        .from('assets')
        .select(
          'id, name, kind, storage_path, url, mime_type, size_bytes, analysis_status, analysis_summary, created_at',
        )
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('brand_profiles')
        .select('logo_url, edited_fields')
        .eq('client_id', clientId)
        .maybeSingle(),
    ]);
    setAssets((aRes.data ?? []) as AssetRow[]);
    setLogoUrl((bRes.data?.logo_url as string | null) ?? null);
    setEditedFields((bRes.data?.edited_fields as Record<string, boolean> | null) ?? {});
  }, [clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onFiles(files: FileList | null) {
    if (!supabase || !files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const mime = file.type || 'application/octet-stream';
      const path = `${clientId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: mime,
        upsert: false,
      });
      if (up.error) {
        errors.push(`${file.name}: ${up.error.message}`);
        continue;
      }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const ins = await supabase.from('assets').insert({
        client_id: clientId,
        name: file.name,
        kind: inferKind(mime),
        storage_path: path,
        url,
        mime_type: mime,
        size_bytes: file.size,
      });
      if (ins.error) {
        // Roll back the orphaned object so storage + table stay in sync.
        await supabase.storage.from(BUCKET).remove([path]);
        errors.push(`${file.name}: ${ins.error.message}`);
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    setMsg(
      errors.length
        ? { kind: 'err', text: `Some uploads failed — ${errors.join('; ')}` }
        : { kind: 'ok', text: 'Uploaded.' },
    );
    refresh();
  }

  async function onDelete(a: AssetRow) {
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    await supabase.storage.from(BUCKET).remove([a.storage_path]);
    const { error } = await supabase.from('assets').delete().eq('id', a.id);
    setBusy(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    if (selectedId === a.id) setSelectedId(null);
    refresh();
  }

  // Make an uploaded image the client's brand logo. Marks edited_fields.logo_url
  // so re-analysis won't clobber it, and tags the row's kind as Logo.
  async function onSetLogo(a: AssetRow) {
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    const nextEdited = { ...editedFields, logo_url: true };
    const bp = await supabase.from('brand_profiles').upsert(
      {
        client_id: clientId,
        logo_url: a.url,
        edited_fields: nextEdited,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' },
    );
    if (bp.error) {
      setBusy(false);
      setMsg({ kind: 'err', text: bp.error.message });
      return;
    }
    await supabase.from('assets').update({ kind: 'Logo' }).eq('id', a.id);
    setBusy(false);
    setLogoUrl(a.url);
    setEditedFields(nextEdited);
    setMsg({ kind: 'ok', text: `“${a.name}” is now the client logo.` });
    refresh();
  }

  const filtered = useMemo(() => {
    const list = assets ?? [];
    if (filter === 'All') return list;
    if (filter === 'AI-analyzed') return list.filter((a) => a.analysis_status === 'Analyzed');
    return list.filter((a) => a.kind === FILTER_TO_KIND[filter]);
  }, [assets, filter]);

  const selected = selectedId ? (assets ?? []).find((a) => a.id === selectedId) ?? null : null;

  if (assets === null) return <div className="meta">Loading…</div>;

  const uploadInput = (
    <input
      ref={fileRef}
      type="file"
      multiple
      hidden
      onChange={(e) => onFiles(e.target.files)}
    />
  );

  if (assets.length === 0) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
      >
        {uploadInput}
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="upload" size={32} />
        </div>
        <div className="h2">No assets uploaded yet</div>
        <div className="meta" style={{ maxWidth: 360 }}>
          Upload logos, photos, videos, or brand docs. Set an image as the client logo and it
          shows across the app — and is protected from being overwritten on the next website
          analysis.
        </div>
        <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={13} /> {busy ? 'Uploading…' : 'Upload'}
        </button>
        {msg && <Banner msg={msg} />}
      </div>
    );
  }

  return (
    <div className="stack gap-12">
      {uploadInput}
      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pill ${active ? 'teal' : ''}`}
              style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
            >
              {active && <span className="dot" />}
              {f}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button className="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={13} /> {busy ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {msg && <Banner msg={msg} />}

      <div className="grid grid-4 gap-16" style={{ gap: 16 }}>
        {filtered.map((a) => {
          const isSelected = a.id === selectedId;
          const isLogo = !!logoUrl && a.url === logoUrl;
          return (
            <div
              key={a.id}
              className="card stack"
              style={{
                overflow: 'hidden',
                cursor: 'pointer',
                outline: isSelected ? '1px solid var(--accent)' : undefined,
              }}
              onClick={() => setSelectedId(a.id)}
            >
              <div
                className="ph"
                style={{
                  height: 120,
                  borderRadius: 0,
                  borderLeft: 0,
                  borderRight: 0,
                  borderTop: 0,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {isImage(a) ? (
                  <img
                    src={a.url}
                    alt={a.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Icon name={a.kind === 'Video' ? 'image' : 'report'} size={28} />
                )}
                {isLogo && (
                  <span
                    className="pill teal"
                    style={{ position: 'absolute', top: 6, left: 6, fontSize: 10 }}
                  >
                    Logo
                  </span>
                )}
              </div>
              <div className="card-pad stack gap-4" style={{ padding: 12 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.name}
                </span>
                <div className="row between">
                  <span className="meta" style={{ fontSize: 11 }}>
                    {[sizeLabel(a.size_bytes), dateLabel(a.created_at)].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="row gap-8" style={{ paddingTop: 2 }}>
                  {isImage(a) && !isLogo && (
                    <button
                      className="btn ghost sm"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetLogo(a);
                      }}
                    >
                      Set as logo
                    </button>
                  )}
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn ghost sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View ↗
                  </a>
                  <button
                    className="btn ghost sm"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(a);
                    }}
                    style={{ marginLeft: 'auto' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected?.analysis_summary && (
        <div className="ai-surface card-pad stack gap-6">
          <div className="row gap-8">
            <AIBadge />
            <span style={{ fontWeight: 500, fontSize: 13 }}>Analysis of {selected.name}</span>
          </div>
          <div className="meta">{selected.analysis_summary}</div>
        </div>
      )}
    </div>
  );
}

function Banner({ msg }: { msg: { kind: 'ok' | 'err'; text: string } }) {
  return (
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
  );
}

// ---------------------------------------------------------------------------
// Wireframe (mock provider, /dev) — unchanged design reference.
// ---------------------------------------------------------------------------

function WireframeAssetsTab({ clientId }: { clientId: string }) {
  const { data: assets, loading } = useQuery<Asset[]>(
    (p) => p.listAssetsForClient(clientId),
    [clientId],
  );

  const [filter, setFilter] = useState<Filter>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!assets) return [];
    if (filter === 'All') return assets;
    if (filter === 'AI-analyzed') return assets.filter((a) => a.analysisStatus === 'Analyzed');
    return assets.filter((a) => a.kind === FILTER_TO_KIND[filter]);
  }, [assets, filter]);

  const selected = selectedId
    ? assets?.find((a) => a.id === selectedId) ?? null
    : (assets?.find((a) => a.analysisSummary) ?? null);

  if (loading) {
    return <div className="meta">Loading…</div>;
  }

  if (!assets || assets.length === 0) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
      >
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="upload" size={32} />
        </div>
        <div className="h2">No assets uploaded yet</div>
        <div className="meta" style={{ maxWidth: 360 }}>
          Upload logos, photos, videos, or brand docs — we'll auto-analyze them so the Ad Studio can reuse them on-brand.
        </div>
        <button className="btn primary">
          <Icon name="upload" size={13} /> Upload
        </button>
      </div>
    );
  }

  return (
    <div className="stack gap-12">
      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <div className="input" style={{ width: 260 }}>
          <Icon name="search" size={13} />
          <span style={{ color: 'var(--fg-2)' }}>Search assets…</span>
        </div>
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pill ${active ? 'teal' : ''}`}
              style={{ border: 0, cursor: 'pointer', font: 'inherit' }}
            >
              {active && <span className="dot" />}
              {f}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button className="btn ghost">
          <Icon name="upload" size={13} /> Upload
        </button>
        <button className="btn ai">
          <Icon name="sparkles" size={13} /> Analyze selected
        </button>
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16 }}>
        {filtered.map((a) => {
          const isSelected = a.id === selectedId;
          return (
            <div
              key={a.id}
              className="card stack"
              style={{
                overflow: 'hidden',
                cursor: 'pointer',
                outline: isSelected ? '1px solid var(--accent)' : undefined,
              }}
              onClick={() => setSelectedId(a.id)}
            >
              <div
                className="ph"
                style={{ height: 120, borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}
              >
                {a.kind}
              </div>
              <div className="card-pad stack gap-4" style={{ padding: 12 }}>
                <div className="row between">
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.name}
                  </span>
                  <input type="checkbox" onClick={(e) => e.stopPropagation()} />
                </div>
                <div className="row between">
                  <span className="meta" style={{ fontSize: 11 }}>
                    {a.sizeLabel} · {a.dateLabel}
                  </span>
                  <span
                    className={`pill ${STATUS_PILL[a.analysisStatus]}`}
                    style={{ padding: '0 6px', fontSize: 10 }}
                  >
                    <span className="dot" />
                    {a.analysisStatus}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected?.analysisSummary && (
        <div className="ai-surface card-pad stack gap-6">
          <div className="row gap-8">
            <AIBadge />
            <span style={{ fontWeight: 500, fontSize: 13 }}>Analysis of {selected.name}</span>
          </div>
          <div className="meta">{selected.analysisSummary}</div>
          <div className="row gap-8">
            <button className="btn sm">Edit analysis</button>
            <button className="btn ghost sm">Use in Ad Studio →</button>
          </div>
        </div>
      )}
    </div>
  );
}
