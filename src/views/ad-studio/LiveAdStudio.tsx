// Live Ad Studio: brief → creative directions → generated copy →
// edit → save. Runs on the background-job pipeline (enqueue-job /
// run-job); the wireframe AdStudio stays as-is for /dev.
//
// Flow (donor Swimm app's shape):
//   1. Brief — client (unless scoped), landing page URL, campaign idea,
//      medium.
//   2. Directions — optional creative_directions job → pick one or skip.
//   3. Copy — copy_generation job → editable results (ResultsEditor).
//   4. Save — insert/update a generations row.

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { enqueueJob, useJob } from '../../data/useJob';
import { ResultsEditor, type GenerationResults } from './ResultsEditor';

type Medium = 'GOOGLE_ADS' | 'META' | 'BOTH';

interface Direction {
  id?: number;
  title: string;
  hook: string;
  description: string;
  themes: string[];
}

const MEDIUMS: Array<{ id: Medium; label: string }> = [
  { id: 'BOTH', label: 'Google + META' },
  { id: 'GOOGLE_ADS', label: 'Google Ads only' },
  { id: 'META', label: 'META only' },
];

export function LiveAdStudio({
  clientId: scopedClientId,
  locationId,
}: {
  clientId?: string;
  locationId?: string;
}) {
  const workspace = useWorkspace();
  const location = useLocation();
  // "Draft ad from this angle" (competitors tab) navigates here with a
  // pre-filled campaign idea in router state.
  const prefillIdea = (location.state as { prefillIdea?: string } | null)?.prefillIdea;

  // Brief state
  const [clientId, setClientId] = useState<string | null>(scopedClientId ?? null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [campaignName, setCampaignName] = useState('');
  const [landingUrl, setLandingUrl] = useState('');
  const [idea, setIdea] = useState(prefillIdea ?? '');
  const [medium, setMedium] = useState<Medium>('BOTH');
  const [extraContext, setExtraContext] = useState('');

  // Directions state
  const [directionsJobId, setDirectionsJobId] = useState<string | null>(null);
  const [directions, setDirections] = useState<Direction[] | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);

  // Copy state
  const [copyJobId, setCopyJobId] = useState<string | null>(null);
  const [results, setResults] = useState<GenerationResults | null>(null);

  // Save state
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const directionsJob = useJob<{ directions: Direction[] }>(directionsJobId);
  const copyJob = useJob<GenerationResults>(copyJobId);

  // Client picker (top-level Ad Studio only — scoped views pass a client).
  useEffect(() => {
    if (scopedClientId || !supabase || !workspace) return;
    supabase
      .from('clients')
      .select('id, name')
      .eq('workspace_id', workspace.id)
      .order('name')
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{ id: string; name: string }>;
        setClients(rows);
        if (rows.length > 0) setClientId((prev) => prev ?? rows[0].id);
      });
  }, [scopedClientId, workspace?.id]);

  useEffect(() => {
    if (directionsJob.completed && directionsJob.job?.result?.directions) {
      setDirections(directionsJob.job.result.directions);
    }
  }, [directionsJob.completed, directionsJob.job]);

  useEffect(() => {
    if (copyJob.completed && copyJob.job?.result) {
      setResults(copyJob.job.result);
      setSavedAt(null);
    }
  }, [copyJob.completed, copyJob.job]);

  const briefReady = !!clientId && idea.trim().length > 0;
  const generating = directionsJob.running || copyJob.running;

  const briefInput = {
    campaign_name: campaignName,
    campaign_idea: idea,
    landing_page_url: landingUrl,
    medium,
    additional_context: extraContext,
    ...(locationId ? { location_id: locationId } : {}),
  };

  async function startDirections(adjustments?: string) {
    if (!workspace || !clientId) return;
    setError(null);
    setDirections(null);
    setSelectedDirection(null);
    try {
      const id = await enqueueJob({
        type: 'creative_directions',
        workspaceId: workspace.id,
        clientId,
        input: { ...briefInput, ...(adjustments ? { adjustments } : {}) },
      });
      setDirectionsJobId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function startCopy(direction: Direction | null) {
    if (!workspace || !clientId) return;
    setError(null);
    setResults(null);
    try {
      const id = await enqueueJob({
        type: 'copy_generation',
        workspaceId: workspace.id,
        clientId,
        input: { ...briefInput, ...(direction ? { direction } : {}) },
      });
      setCopyJobId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function save(status: 'draft' | 'final') {
    if (!supabase || !workspace || !clientId || !results) return;
    setSaving(true);
    setError(null);
    const payload = {
      workspace_id: workspace.id,
      client_id: clientId,
      location_id: locationId ?? null,
      campaign_name: campaignName || idea.slice(0, 80),
      landing_page_url: landingUrl || null,
      campaign_idea: idea,
      medium,
      additional_context: extraContext || null,
      direction: selectedDirection,
      google_ads: results.google_ads ?? null,
      meta_output: results.meta ?? null,
      provider_meta: { job_id: copyJobId },
      status,
      updated_at: new Date().toISOString(),
    };
    const query = generationId
      ? supabase.from('generations').update(payload).eq('id', generationId).select('id').single()
      : supabase.from('generations').insert(payload).select('id').single();
    const { data, error: err } = await query;
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setGenerationId((data?.id as string) ?? generationId);
    setSavedAt(new Date().toLocaleTimeString());
  }

  if (!workspace) return null;

  // Scoped mounts (client/location Ad Studio) render their own header +
  // breadcrumb and already sit inside a .content wrapper.
  const embedded = !!scopedClientId;

  return (
    <div className={embedded ? 'stack' : 'content wide'}>
      {!embedded && (
        <div className="row between" style={{ marginBottom: 16 }}>
          <div className="stack gap-4">
            <h1 className="h0">Ad Studio</h1>
            <span className="meta">
              Landing page + campaign idea in, platform-ready Google & META copy out.
            </span>
          </div>
        </div>
      )}

      {/* ---- Step 1: Brief ---- */}
      <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="stack gap-4">
            <div className="row gap-8">
              <span className="pill teal" style={{ fontSize: 11 }}>
                <span className="dot" />
                Step 1
              </span>
              <span className="h2">Your brief</span>
            </div>
            <span className="meta">
              Everything downstream is grounded in this — plus the client's brand profile and
              scraped website content.
            </span>
          </div>
        </div>

        <div className="card-pad stack gap-12">
          <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
            {!scopedClientId && (
              <label className="stack gap-4" style={{ minWidth: 200 }}>
                <span className="meta">Client</span>
                <select
                  value={clientId ?? ''}
                  onChange={(e) => setClientId(e.target.value || null)}
                  style={fieldStyle}
                  disabled={generating}
                >
                  {clients.length === 0 && <option value="">No clients yet</option>}
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="stack gap-4" style={{ flex: 1, minWidth: 200 }}>
              <span className="meta">Campaign name</span>
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Spring lead push"
                style={fieldStyle}
                disabled={generating}
              />
            </label>
            <label className="stack gap-4" style={{ minWidth: 180 }}>
              <span className="meta">Platforms</span>
              <select
                value={medium}
                onChange={(e) => setMedium(e.target.value as Medium)}
                style={fieldStyle}
                disabled={generating}
              >
                {MEDIUMS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="stack gap-4">
            <span className="meta">Landing page URL (optional — we'll read it for context)</span>
            <input
              value={landingUrl}
              onChange={(e) => setLandingUrl(e.target.value)}
              placeholder="https://client.com/spring-offer"
              style={fieldStyle}
              disabled={generating}
            />
          </label>

          <label className="stack gap-4">
            <span className="meta">Campaign idea</span>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="What are we promoting, to whom, and what should they do? e.g. '20% off first dental visit for new patients in the Rochester area — book online.'"
              style={{ ...fieldStyle, minHeight: 90, resize: 'vertical' }}
              disabled={generating}
            />
          </label>

          <label className="stack gap-4">
            <span className="meta">Extra context (optional)</span>
            <input
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="Seasonal notes, offers to avoid, competitor angle…"
              style={fieldStyle}
              disabled={generating}
            />
          </label>
        </div>

        <div
          className="card-pad row between"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}
        >
          <span className="meta">
            Pick creative directions first, or generate copy straight from the brief.
          </span>
          <div className="row gap-8">
            <button
              className="btn ai"
              disabled={!briefReady || generating}
              onClick={() => startDirections()}
            >
              <Icon name="sparkles" size={13} /> Suggest directions
            </button>
            <button
              className="btn primary"
              disabled={!briefReady || generating}
              onClick={() => startCopy(null)}
            >
              Generate copy →
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="card card-pad meta" style={{ color: 'var(--danger, #c33)', marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {/* ---- Step 2: Directions ---- */}
      {(directionsJob.running || directionsJob.failed || directions) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="stack gap-4">
              <div className="row gap-8">
                <span className="pill gray" style={{ fontSize: 11 }}>
                  Step 2
                </span>
                <span className="h2">Pick a direction</span>
              </div>
              <span className="meta">
                {directionsJob.running
                  ? directionsJob.job?.progress_message ?? 'Drafting directions…'
                  : directions
                  ? `${directions.length} drafted from your brief. Pick one, regenerate, or skip.`
                  : ''}
              </span>
            </div>
            {directions && (
              <button
                className="btn ai sm"
                disabled={generating}
                onClick={() => startDirections('Give me 3 fresh, different angles.')}
              >
                <Icon name="sparkles" size={12} /> Regenerate all
              </button>
            )}
          </div>

          {directionsJob.running && (
            <div className="card-pad">
              <ProgressRow
                pct={directionsJob.job?.progress ?? 5}
                label={directionsJob.job?.progress_message ?? 'Working…'}
              />
            </div>
          )}
          {directionsJob.failed && (
            <div className="card-pad meta" style={{ color: 'var(--danger, #c33)' }}>
              ⚠ {directionsJob.job?.error}
            </div>
          )}

          {directions && (
            <>
              <div className="grid grid-3 gap-12" style={{ padding: 16, gap: 12 }}>
                {directions.map((d) => {
                  const on = selectedDirection?.title === d.title;
                  return (
                    <div
                      key={d.title}
                      className={`card card-pad stack gap-6 ${on ? 'bdr-green' : ''}`}
                      style={{
                        background: on ? 'rgba(6,182,164,0.05)' : 'var(--bg-2)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedDirection(on ? null : d)}
                    >
                      <div className="row between">
                        <span style={{ fontWeight: 500 }}>{d.title}</span>
                        {on && (
                          <span className="pill teal">
                            <span className="dot" />
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="meta" style={{ fontStyle: 'italic' }}>
                        "{d.hook}"
                      </div>
                      <div className="meta">{d.description}</div>
                      <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
                        {d.themes?.map((t) => (
                          <span key={t} className="pill gray" style={{ fontSize: 10 }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div
                className="card-pad row between"
                style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}
              >
                <span className="meta">
                  {selectedDirection
                    ? `Copy will follow "${selectedDirection.title}".`
                    : 'No direction selected — copy will be generated from the brief alone.'}
                </span>
                <button
                  className="btn primary"
                  disabled={generating}
                  onClick={() => startCopy(selectedDirection)}
                >
                  Generate copy {selectedDirection ? 'with this direction' : ''} →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- Step 3: Results ---- */}
      {(copyJob.running || copyJob.failed) && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          {copyJob.running ? (
            <ProgressRow
              pct={copyJob.job?.progress ?? 5}
              label={copyJob.job?.progress_message ?? 'Generating copy…'}
            />
          ) : (
            <span className="meta" style={{ color: 'var(--danger, #c33)' }}>
              ⚠ {copyJob.job?.error}
            </span>
          )}
        </div>
      )}

      {results && clientId && (
        <>
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="row gap-8">
              <span className="pill gray" style={{ fontSize: 11 }}>
                Step 3
              </span>
              <span className="h2">Generated copy</span>
              <span className="meta">Click any item to edit. Changes save with the draft.</span>
            </div>
            <div className="row gap-8">
              {savedAt && (
                <span className="meta" style={{ fontSize: 11 }}>
                  Saved {savedAt}
                </span>
              )}
              <button className="btn" disabled={saving} onClick={() => save('draft')}>
                {saving ? 'Saving…' : generationId ? 'Save changes' : 'Save draft'}
              </button>
              <button className="btn primary" disabled={saving} onClick={() => save('final')}>
                Save as final
              </button>
            </div>
          </div>
          <ResultsEditor
            results={results}
            onChange={setResults}
            medium={medium}
            workspaceId={workspace.id}
            clientId={clientId}
          />
        </>
      )}
    </div>
  );
}

function ProgressRow({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="stack gap-6">
      <div className="row between">
        <span className="meta">{label}</span>
        <span className="meta">{pct}%</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.max(pct, 4)}%`,
            height: '100%',
            background: 'var(--accent)',
            transition: 'width 400ms ease',
          }}
        />
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  padding: '10px 12px',
  font: 'inherit',
  fontSize: 13,
  outline: 'none',
};
