import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { supabase } from '../../auth/supabaseClient';
import { useQuery } from '../../data/context';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { useJobRunner } from '../../data/useJob';
import type { BrandProfile } from '../../data/types';

export function BrandTab({ clientId }: { clientId: string }) {
  const workspace = useWorkspace();
  if (workspace) return <LiveBrandTab clientId={clientId} workspaceId={workspace.id} />;
  return <WireframeBrandTab clientId={clientId} />;
}

// ---------------------------------------------------------------------------
// Live: editable brand_profiles row + "Analyze from website"
// ---------------------------------------------------------------------------

type ProfileFields = {
  description: string;
  customer_avatars: string;
  brand_voice: string;
  dos: string;
  donts: string;
  additional_notes: string;
  logo_url: string;
};

type FontEntry = { family: string; source: string };

const FIELD_DEFS: Array<{ key: keyof ProfileFields; label: string; hint: string }> = [
  { key: 'description', label: 'Company description', hint: 'Positioning, USP, what they do' },
  { key: 'customer_avatars', label: 'Target audience', hint: 'Who buys, pain points, triggers' },
  { key: 'brand_voice', label: 'Brand voice', hint: 'Tone, personality, phrases to use' },
  { key: 'dos', label: "Do's", hint: 'One rule per line — copy must do these' },
  { key: 'donts', label: "Don'ts", hint: 'One rule per line — copy must never do these' },
  { key: 'additional_notes', label: 'Notes for campaigns', hint: 'Offers, CTAs, proof points' },
];

const EMPTY_FIELDS: ProfileFields = {
  description: '',
  customer_avatars: '',
  brand_voice: '',
  dos: '',
  donts: '',
  additional_notes: '',
  logo_url: '',
};

function LiveBrandTab({ clientId, workspaceId }: { clientId: string; workspaceId: string }) {
  const [fields, setFields] = useState<ProfileFields>(EMPTY_FIELDS);
  const [baseline, setBaseline] = useState<ProfileFields>(EMPTY_FIELDS);
  const [editedFields, setEditedFields] = useState<Record<string, boolean>>({});
  const [palette, setPalette] = useState<string[]>([]);
  const [fonts, setFonts] = useState<FontEntry[]>([]);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyze = useJobRunner();

  async function load() {
    if (!supabase) return;
    const { data } = await supabase
      .from('brand_profiles')
      .select(
        'description, customer_avatars, brand_voice, dos, donts, additional_notes, palette, fonts, logo_url, edited_fields, analyzed_at',
      )
      .eq('client_id', clientId)
      .maybeSingle();
    setLoading(false);
    if (!data) {
      setExists(false);
      return;
    }
    const next: ProfileFields = {
      description: (data.description as string | null) ?? '',
      customer_avatars: (data.customer_avatars as string | null) ?? '',
      brand_voice: (data.brand_voice as string | null) ?? '',
      dos: (data.dos as string | null) ?? '',
      donts: (data.donts as string | null) ?? '',
      additional_notes: (data.additional_notes as string | null) ?? '',
      logo_url: (data.logo_url as string | null) ?? '',
    };
    setFields(next);
    setBaseline(next);
    setEditedFields((data.edited_fields as Record<string, boolean> | null) ?? {});
    setPalette((data.palette as string[] | null) ?? []);
    setFonts((data.fonts as FontEntry[] | null) ?? []);
    setAnalyzedAt((data.analyzed_at as string | null) ?? null);
    setExists(true);
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Reload the profile after a successful analysis run.
  useEffect(() => {
    if (analyze.completed) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyze.completed]);

  const dirty =
    JSON.stringify(fields) !== JSON.stringify(baseline);

  async function save() {
    if (!supabase) return;
    setSaving(true);
    setError(null);
    // Mark every field the human actually changed so re-analysis skips it.
    const nextEdited = { ...editedFields };
    for (const def of [...FIELD_DEFS.map((f) => f.key), 'logo_url' as const]) {
      if (fields[def] !== baseline[def]) nextEdited[def] = true;
    }
    const { error: err } = await supabase.from('brand_profiles').upsert(
      {
        client_id: clientId,
        description: fields.description || null,
        customer_avatars: fields.customer_avatars || null,
        brand_voice: fields.brand_voice || null,
        dos: fields.dos || null,
        donts: fields.donts || null,
        additional_notes: fields.additional_notes || null,
        logo_url: fields.logo_url || null,
        palette: palette.length ? palette : null,
        fonts: fonts.length ? fonts : null,
        edited_fields: nextEdited,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' },
    );
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditedFields(nextEdited);
    setBaseline(fields);
    setExists(true);
  }

  if (loading) return <div className="meta">Loading…</div>;

  return (
    <div className="stack gap-16">
      <div className="card card-pad row between">
        <div className="stack gap-2">
          <span className="h2">Brand profile</span>
          <span className="meta">
            {analyzedAt
              ? `Last analyzed ${new Date(analyzedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}. Fields you edit are protected from re-analysis.`
              : exists
              ? 'Manually curated — run an analysis to fill gaps from the scraped website.'
              : 'No profile yet. Analyze the scraped website or fill the fields manually.'}
          </span>
        </div>
        <div className="row gap-8">
          <button
            className="btn ai sm"
            disabled={analyze.running}
            onClick={() => analyze.start({ type: 'website_analysis', workspaceId, clientId })}
          >
            <Icon name="sparkles" size={12} />
            {analyze.running
              ? `Analyzing… ${analyze.job?.progress ?? 0}%`
              : 'Analyze from website'}
          </button>
          <button className="btn primary sm" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {(analyze.startError || analyze.failed) && (
        <div className="card card-pad meta" style={{ color: 'var(--danger, #c33)' }}>
          ⚠ {analyze.startError ?? analyze.job?.error}
        </div>
      )}
      {error && (
        <div className="card card-pad meta" style={{ color: 'var(--danger, #c33)' }}>
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
        {FIELD_DEFS.map((def) => (
          <div key={def.key} className="card card-pad stack gap-8">
            <div className="row between">
              <span className="h2">{def.label}</span>
              {editedFields[def.key] && (
                <span className="pill gray" style={{ fontSize: 10 }} title="Protected from re-analysis">
                  edited
                </span>
              )}
            </div>
            <textarea
              value={fields[def.key]}
              onChange={(e) => setFields((f) => ({ ...f, [def.key]: e.target.value }))}
              placeholder={def.hint}
              style={{
                minHeight: 110,
                padding: 12,
                font: 'inherit',
                fontSize: 13,
                lineHeight: 1.5,
                background: 'var(--bg-2)',
                color: 'var(--fg)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
        ))}

        <div className="card card-pad stack gap-10">
          <span className="h2">Detected palette</span>
          {palette.length === 0 ? (
            <span className="meta">No colors detected yet — scrape the website first.</span>
          ) : (
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              {palette.map((hex) => (
                <div key={hex} className="stack gap-4" style={{ alignItems: 'center' }}>
                  <div
                    title={`${hex} — click to remove`}
                    onClick={() => setPalette(palette.filter((h) => h !== hex))}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      background: hex,
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  />
                  <span className="meta mono" style={{ fontSize: 10 }}>
                    {hex}
                  </span>
                </div>
              ))}
            </div>
          )}
          <span className="meta" style={{ fontSize: 11 }}>
            Heuristic — extracted from the site's CSS. Click a swatch to remove it.
          </span>
        </div>

        <div className="card card-pad stack gap-10">
          <span className="h2">Detected fonts</span>
          {fonts.length === 0 ? (
            <span className="meta">No fonts detected yet — scrape the website first.</span>
          ) : (
            <div className="stack gap-6">
              {fonts.map((f) => (
                <div key={f.family} className="row between">
                  <span style={{ fontSize: 13 }}>{f.family}</span>
                  <div className="row gap-6">
                    <span className="pill gray" style={{ fontSize: 10 }}>
                      {f.source}
                    </span>
                    <button
                      className="btn ghost sm"
                      style={{ padding: '2px 6px' }}
                      onClick={() => setFonts(fonts.filter((x) => x.family !== f.family))}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad stack gap-10" style={{ gridColumn: '1/-1' }}>
          <span className="h2">Logo</span>
          <div className="row gap-12" style={{ alignItems: 'center' }}>
            {fields.logo_url ? (
              <img
                src={fields.logo_url}
                alt="logo"
                style={{
                  maxHeight: 72,
                  maxWidth: 200,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  padding: 8,
                  background: 'var(--bg-2)',
                }}
              />
            ) : (
              <div className="ph" style={{ width: 120, height: 72, borderRadius: 8 }}>
                No logo
              </div>
            )}
            <input
              value={fields.logo_url}
              onChange={(e) => setFields((f) => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://client.com/logo.svg"
              style={{
                flex: 1,
                background: 'var(--bg-1)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--fg)',
                padding: '10px 12px',
                font: 'inherit',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wireframe (/dev) — original mock-backed view, unchanged
// ---------------------------------------------------------------------------

function WireframeBrandTab({ clientId }: { clientId: string }) {
  const { data: brand, loading } = useQuery<BrandProfile | null>(
    (p) => p.getBrandProfile(clientId),
    [clientId],
  );

  if (loading) {
    return <div className="meta">Loading…</div>;
  }

  if (!brand) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
      >
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="sparkles" size={32} />
        </div>
        <div className="h2">No brand profile yet</div>
        <div className="meta" style={{ maxWidth: 360 }}>
          Add a description, voice, and do's/don'ts so AI-generated content stays on-brand.
        </div>
        <button className="btn primary">
          <Icon name="plus" size={13} /> Create brand profile
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
      <div className="card card-pad stack gap-12">
        <span className="h2">Company description</span>
        <div
          className="ph"
          style={{
            minHeight: 80,
            padding: 12,
            textAlign: 'left',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          }}
        >
          {brand.description}
        </div>
      </div>

      <div className="card card-pad stack gap-12">
        <span className="h2">Brand voice</span>
        <div
          className="ph"
          style={{
            minHeight: 80,
            padding: 12,
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            textAlign: 'left',
          }}
        >
          {brand.voice}
        </div>
      </div>

      <div className="card card-pad stack gap-12">
        <span className="h2">Do's</span>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-1)' }}>
          {brand.dos.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      <div className="card card-pad stack gap-12">
        <span className="h2">Don'ts</span>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-1)' }}>
          {brand.donts.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      <div className="card card-pad stack gap-12" style={{ gridColumn: '1/-1' }}>
        <div className="row between">
          <span className="h2">Logo</span>
          <button className="btn sm">
            <Icon name="upload" size={12} /> Upload new
          </button>
        </div>
        <div className="ph" style={{ height: 120, borderRadius: 8 }}>
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="logo" style={{ maxHeight: 100 }} />
          ) : (
            'Drag + drop logo (SVG, PNG)'
          )}
        </div>
      </div>
    </div>
  );
}
