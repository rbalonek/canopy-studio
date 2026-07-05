import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AIBadge } from '../../components/AIBadge';
import { Icon } from '../../components/Icon';
import { Spark } from '../../components/Spark';
import { supabase } from '../../auth/supabaseClient';
import { useQuery } from '../../data/context';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { enqueueJob, useJob } from '../../data/useJob';
import type { Competitor } from '../../data/types';

export function CompetitorsTab({ clientId }: { clientId: string }) {
  const workspace = useWorkspace();
  if (workspace) return <LiveCompetitorsTab clientId={clientId} workspaceId={workspace.id} />;
  return <WireframeCompetitorsTab clientId={clientId} />;
}

// ---------------------------------------------------------------------------
// Live
// ---------------------------------------------------------------------------

type CompetitorRow = {
  id: string;
  domain: string;
  name: string | null;
  enabled: boolean;
  last_scraped_at: string | null;
  analyzed_at: string | null;
  analysis: {
    positioning_summary?: string;
    comparison_rows?: Array<{
      dimension: string;
      client: string;
      competitor: string;
      advantage: 'client' | 'competitor' | 'neutral';
    }>;
    takeaway?: string;
  } | null;
};

type GapAngleRow = {
  id: string;
  competitor_id: string | null;
  title: string;
  confidence: number;
  evidence: string | null;
};

function LiveCompetitorsTab({ clientId, workspaceId }: { clientId: string; workspaceId: string }) {
  const [rows, setRows] = useState<CompetitorRow[] | null>(null);
  const [angles, setAngles] = useState<GapAngleRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // One in-flight scrape+analysis at a time, keyed by competitor id.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob(jobId);

  async function refresh() {
    if (!supabase) return;
    const [cRes, gRes] = await Promise.all([
      supabase
        .from('competitors')
        .select('id, domain, name, enabled, last_scraped_at, analyzed_at, analysis')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true }),
      supabase
        .from('gap_angles')
        .select('id, competitor_id, title, confidence, evidence')
        .eq('client_id', clientId)
        .order('confidence', { ascending: false }),
    ]);
    setRows((cRes.data ?? []) as unknown as CompetitorRow[]);
    setAngles((gRes.data ?? []) as unknown as GapAngleRow[]);
  }

  useEffect(() => {
    setRows(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    if (job.completed || job.failed) {
      setBusyId(null);
      setBusyLabel('');
      setJobId(null);
      if (job.failed) setError(job.job?.error ?? 'Analysis failed');
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.completed, job.failed]);

  async function addCompetitor() {
    if (!supabase || !newDomain.trim()) return;
    setError(null);
    const domain = newDomain
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');
    const { error: err } = await supabase.from('competitors').insert({
      client_id: clientId,
      domain,
      name: newName.trim() || null,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setNewDomain('');
    setNewName('');
    setAdding(false);
    refresh();
  }

  async function scrapeAndAnalyze(row: CompetitorRow) {
    if (!supabase) return;
    setError(null);
    setBusyId(row.id);
    setBusyLabel('Scraping site…');
    const { data, error: scrapeErr } = await supabase.functions.invoke('scrape-client', {
      body: { client_id: clientId, url: `https://${row.domain}`, competitor_id: row.id },
    });
    if (scrapeErr || !data?.ok) {
      setBusyId(null);
      setError(scrapeErr?.message ?? data?.error ?? 'Scrape failed');
      return;
    }
    setBusyLabel('Analyzing vs your brand…');
    try {
      const id = await enqueueJob({
        type: 'competitor_analysis',
        workspaceId,
        clientId,
        input: { competitor_id: row.id },
      });
      setJobId(id);
    } catch (e) {
      setBusyId(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(row: CompetitorRow) {
    if (!supabase) return;
    if (!confirm(`Stop tracking ${row.name ?? row.domain}? Scraped data and angles are removed.`))
      return;
    await supabase.from('competitors').delete().eq('id', row.id);
    refresh();
  }

  if (rows === null) return <div className="meta">Loading…</div>;

  return (
    <div className="stack gap-16">
      <div className="row between">
        <span className="meta">
          Track competitors' sites — we scrape them and surface positioning gaps your ads can
          exploit. Social pages can't be scraped; ad-library intel comes later.
        </span>
        {!adding && (
          <button className="btn primary sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={12} /> Add competitor
          </button>
        )}
      </div>

      {adding && (
        <div className="card card-pad row gap-8" style={{ flexWrap: 'wrap' }}>
          <input
            autoFocus
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="competitor.com"
            style={liveInputStyle}
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (optional)"
            style={liveInputStyle}
          />
          <button className="btn primary sm" onClick={addCompetitor} disabled={!newDomain.trim()}>
            Add
          </button>
          <button className="btn ghost sm" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="card card-pad meta" style={{ color: 'var(--danger, #c33)' }}>
          ⚠ {error}
        </div>
      )}

      {rows.length === 0 && !adding && (
        <div
          className="card card-pad-lg stack gap-12"
          style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
        >
          <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
            <Icon name="brain" size={32} />
          </div>
          <div className="h2">No competitors tracked yet</div>
          <div className="meta" style={{ maxWidth: 360 }}>
            Add a competitor domain and we'll scrape their site, compare positioning against your
            brand profile, and surface ad angles they're missing.
          </div>
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={13} /> Add competitor
          </button>
        </div>
      )}

      {rows.map((row) => (
        <CompetitorCard
          key={row.id}
          row={row}
          angles={angles.filter((a) => a.competitor_id === row.id)}
          busy={busyId === row.id}
          busyLabel={busyId === row.id ? busyLabel : ''}
          progress={busyId === row.id ? job.job?.progress ?? null : null}
          onScrape={() => scrapeAndAnalyze(row)}
          onDelete={() => remove(row)}
          clientId={clientId}
        />
      ))}
    </div>
  );
}

function CompetitorCard({
  row,
  angles,
  busy,
  busyLabel,
  progress,
  onScrape,
  onDelete,
  clientId,
}: {
  row: CompetitorRow;
  angles: GapAngleRow[];
  busy: boolean;
  busyLabel: string;
  progress: number | null;
  onScrape: () => void;
  onDelete: () => void;
  clientId: string;
}) {
  const [showComparison, setShowComparison] = useState(false);
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const analysis = row.analysis;

  function draftFromAngle(angle: GapAngleRow) {
    const prefix = slug ? `/app/${slug}` : '/dev';
    navigate(`${prefix}/clients/${clientId}/ad-studio`, {
      state: {
        prefillIdea: `Angle: ${angle.title}. ${angle.evidence ?? ''} (competitive gap vs ${
          row.name ?? row.domain
        })`,
      },
    });
  }

  return (
    <div className="card">
      <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="stack gap-2">
          <div className="row gap-8">
            <span style={{ fontWeight: 500 }}>{row.name ?? row.domain}</span>
            <span className="meta">{row.domain}</span>
          </div>
          <span className="meta" style={{ fontSize: 11 }}>
            {row.last_scraped_at
              ? `Scraped ${new Date(row.last_scraped_at).toLocaleDateString()}`
              : 'Not scraped yet'}
            {row.analyzed_at
              ? ` · analyzed ${new Date(row.analyzed_at).toLocaleDateString()}`
              : ''}
          </span>
        </div>
        <div className="row gap-6">
          <button className="btn ai sm" onClick={onScrape} disabled={busy}>
            <Icon name="sparkles" size={12} />
            {busy ? `${busyLabel}${progress !== null ? ` ${progress}%` : ''}` : 'Scrape & analyze'}
          </button>
          <button className="btn ghost sm" onClick={onDelete} disabled={busy}>
            Remove
          </button>
        </div>
      </div>

      {analysis && (
        <div className="card-pad stack gap-10">
          {analysis.positioning_summary && (
            <div className="stack gap-2">
              <span className="meta" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Their positioning
              </span>
              <span style={{ fontSize: 13 }}>{analysis.positioning_summary}</span>
            </div>
          )}
          {analysis.takeaway && (
            <div className="ai-surface card-pad stack gap-2">
              <span className="meta" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Takeaway for your ads
              </span>
              <span style={{ fontSize: 13 }}>{analysis.takeaway}</span>
            </div>
          )}

          {!!analysis.comparison_rows?.length && (
            <div className="stack gap-6">
              <button
                className="btn sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setShowComparison((v) => !v)}
              >
                {showComparison ? 'Hide comparison' : `Compare (${analysis.comparison_rows.length} dimensions)`}
              </button>
              {showComparison && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Dimension', 'You', row.name ?? row.domain, 'Edge'].map((h) => (
                          <th
                            key={h}
                            className="meta"
                            style={{
                              textAlign: 'left',
                              padding: '6px 8px',
                              borderBottom: '1px solid var(--border)',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.comparison_rows.map((r, i) => (
                        <tr key={i}>
                          <td style={cellStyle}>{r.dimension}</td>
                          <td style={cellStyle}>{r.client}</td>
                          <td style={cellStyle}>{r.competitor}</td>
                          <td style={cellStyle}>
                            <span
                              className={`pill ${
                                r.advantage === 'client'
                                  ? 'teal'
                                  : r.advantage === 'competitor'
                                  ? 'red'
                                  : 'gray'
                              }`}
                              style={{ fontSize: 10 }}
                            >
                              {r.advantage === 'client'
                                ? 'You'
                                : r.advantage === 'competitor'
                                ? 'Them'
                                : 'Even'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {angles.length > 0 && (
            <div className="stack gap-6">
              <span className="meta" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Gap angles
              </span>
              {angles.map((a) => (
                <div key={a.id} className="row between" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <div className="stack gap-2" style={{ flex: 1 }}>
                    <div className="row gap-8">
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{a.title}</span>
                      <span className="pill gray" style={{ fontSize: 10 }}>
                        {a.confidence}% confidence
                      </span>
                    </div>
                    {a.evidence && (
                      <span className="meta" style={{ fontSize: 11 }}>
                        {a.evidence}
                      </span>
                    )}
                  </div>
                  <button className="btn sm" onClick={() => draftFromAngle(a)}>
                    <Icon name="sparkles" size={11} /> Draft ad
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
};

const liveInputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  padding: '10px 12px',
  font: 'inherit',
  fontSize: 13,
  outline: 'none',
};

// ---------------------------------------------------------------------------
// Wireframe (/dev) — original mock-backed view, unchanged
// ---------------------------------------------------------------------------

function WireframeCompetitorsTab({ clientId }: { clientId: string }) {
  const { data: competitors, loading } = useQuery<Competitor[]>(
    (p) => p.listCompetitorsForClient(clientId),
    [clientId],
  );

  if (loading) {
    return <div className="meta">Loading…</div>;
  }

  if (!competitors || competitors.length === 0) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
      >
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="brain" size={32} />
        </div>
        <div className="h2">No competitors tracked yet</div>
        <div className="meta" style={{ maxWidth: 360 }}>
          Paste a competitor URL and we'll discover their sitemap, extract positioning, and surface messaging gaps.
        </div>
        <button className="btn primary">
          <Icon name="plus" size={13} /> Add competitor
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
      {competitors.map((c) => (
        <div key={c.domain} className="ai-surface card-pad stack gap-8">
          <div className="row between">
            <div className="row gap-8">
              <div className="ph" style={{ width: 22, height: 22, borderRadius: 4 }} />
              <span style={{ fontWeight: 500 }}>{c.domain}</span>
            </div>
            <AIBadge />
          </div>
          <div className="meta">
            {c.industry} · tracked since {c.since}
          </div>
          <div className="row between">
            <div className="stack gap-4">
              <span className="meta">Content velocity</span>
              <Spark seed={c.velocity} w={100} h={24} />
            </div>
            <div className="stack gap-4" style={{ alignItems: 'flex-end' }}>
              <span className="meta">SoV vs you</span>
              <span style={{ fontWeight: 500 }}>{c.sov}%</span>
            </div>
          </div>
          <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
            {c.pillars.map((p) => (
              <span key={p} className="tag">
                {p}
              </span>
            ))}
          </div>
          <div className="row gap-8">
            <button className="btn sm">View analysis</button>
            <button className="btn ghost sm">Compare</button>
          </div>
        </div>
      ))}
    </div>
  );
}
