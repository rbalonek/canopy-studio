// AI suggestions queue on the live dashboard. Rows come from the
// account_analysis job (weekly cron or "Analyze now"); members work the
// queue with acknowledge / dismiss / draft-an-ad.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { supabase } from '../auth/supabaseClient';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { enqueueJob } from '../data/useJob';

type SuggestionRow = {
  id: string;
  client_id: string | null;
  priority: 'high' | 'medium' | 'low';
  action: string;
  reasoning: string | null;
  expected_impact: string | null;
  campaign_id: string | null;
  status: 'new' | 'acknowledged' | 'dismissed' | 'actioned';
  created_at: string;
  clients: { name: string } | null;
};

const PRIORITY_PILL: Record<SuggestionRow['priority'], string> = {
  high: 'red',
  medium: 'amber',
  low: 'gray',
};

const COLLAPSE_KEY = 'canopy.overview.suggestions.collapsed';

export function SuggestionsPanel() {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const [rows, setRows] = useState<SuggestionRow[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  function toggleCollapsed() {
    setCollapsed((v) => {
      localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      return !v;
    });
  }

  async function refresh() {
    if (!supabase || !workspace) return;
    const { data } = await supabase
      .from('suggestions')
      .select(
        'id, client_id, priority, action, reasoning, expected_impact, campaign_id, status, created_at, clients(name)',
      )
      .eq('workspace_id', workspace.id)
      .in('status', ['new', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(50);
    setRows((data ?? []) as unknown as SuggestionRow[]);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  async function setStatus(id: string, status: SuggestionRow['status']) {
    if (!supabase) return;
    await supabase.from('suggestions').update({ status }).eq('id', id);
    refresh();
  }

  async function analyzeNow() {
    if (!supabase || !workspace) return;
    setAnalyzing(true);
    setNote(null);
    // One analysis job per client that has campaign data.
    const { data } = await supabase
      .from('campaigns')
      .select('client_id, clients!inner(workspace_id)')
      .eq('clients.workspace_id', workspace.id);
    const clientIds = Array.from(new Set((data ?? []).map((r) => r.client_id as string)));
    if (clientIds.length === 0) {
      setNote('No campaign data yet — connect Meta and refresh first.');
      setAnalyzing(false);
      return;
    }
    let queued = 0;
    for (const clientId of clientIds) {
      try {
        await enqueueJob({ type: 'account_analysis', workspaceId: workspace.id, clientId });
        queued++;
      } catch (e) {
        console.warn(`analysis enqueue failed for ${clientId}:`, e);
      }
    }
    setNote(
      queued > 0
        ? `Analyzing ${queued} client${queued === 1 ? '' : 's'} — new suggestions appear here in a minute or two.`
        : 'Could not start the analysis — check the AI settings and API keys.',
    );
    setAnalyzing(false);
    // Pull fresh rows a few times while the jobs finish.
    for (const delay of [20_000, 45_000, 90_000]) {
      setTimeout(refresh, delay);
    }
  }

  function draftAd(s: SuggestionRow) {
    if (!workspace || !s.client_id) return;
    setStatus(s.id, 'actioned');
    navigate(`/app/${workspace.slug}/clients/${s.client_id}/ad-studio`, {
      state: {
        prefillIdea: `${s.action}${s.reasoning ? ` — ${s.reasoning}` : ''}`,
      },
    });
  }

  if (!workspace || rows === null) return null;

  const visible = showAll ? rows : rows.slice(0, 5);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        className="card-pad row between"
        style={{ borderBottom: collapsed ? 0 : '1px solid var(--border)' }}
      >
        <div
          className="stack gap-2"
          style={{ cursor: 'pointer', flex: 1 }}
          onClick={toggleCollapsed}
          title={collapsed ? 'Show suggestions' : 'Hide suggestions'}
        >
          <div className="row gap-8">
            <span
              style={{
                display: 'inline-block',
                transition: 'transform 0.15s',
                transform: collapsed ? 'rotate(-90deg)' : 'none',
                fontSize: 11,
                color: 'var(--fg-2)',
              }}
            >
              ▼
            </span>
            <Icon name="sparkles" size={14} />
            <span className="h2">AI suggestions</span>
            {rows.length > 0 && (
              <span className="pill teal" style={{ fontSize: 10 }}>
                {rows.length}
              </span>
            )}
          </div>
          {!collapsed && (
            <span className="meta" style={{ fontSize: 11 }}>
              Weekly account analysis (strategy-aware: lead gen judged on CPL, warm-ups on
              engagement, sales on ROAS) plus competitor context.
            </span>
          )}
        </div>
        <button className="btn ai sm" onClick={analyzeNow} disabled={analyzing}>
          <Icon name="sparkles" size={11} /> {analyzing ? 'Queuing…' : 'Analyze now'}
        </button>
      </div>

      {collapsed ? null : (
        <>
      {note && (
        <div className="card-pad meta" style={{ fontSize: 12, borderBottom: '1px solid var(--border)' }}>
          {note}
        </div>
      )}

      {rows.length === 0 && !note && (
        <div className="card-pad meta">
          No open suggestions. Run an analysis or wait for the Monday sweep.
        </div>
      )}

      {visible.map((s, i) => (
        <div
          key={s.id}
          className="card-pad row between"
          style={{
            gap: 12,
            alignItems: 'flex-start',
            borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 0,
            opacity: s.status === 'acknowledged' ? 0.7 : 1,
          }}
        >
          <div className="stack gap-4" style={{ flex: 1 }}>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <span className={`pill ${PRIORITY_PILL[s.priority]}`} style={{ fontSize: 10 }}>
                {s.priority}
              </span>
              {s.clients?.name && (
                <span className="meta" style={{ fontSize: 11 }}>
                  {s.clients.name}
                </span>
              )}
              <span style={{ fontWeight: 500, fontSize: 13 }}>{s.action}</span>
            </div>
            {s.reasoning && (
              <span className="meta" style={{ fontSize: 12 }}>
                {s.reasoning}
              </span>
            )}
            {s.expected_impact && (
              <span className="meta" style={{ fontSize: 11 }}>
                Expected: {s.expected_impact}
              </span>
            )}
          </div>
          <div className="row gap-6" style={{ flexShrink: 0 }}>
            <button className="btn sm" onClick={() => draftAd(s)} disabled={!s.client_id}>
              <Icon name="sparkles" size={11} /> Draft ad
            </button>
            {s.status === 'new' && (
              <button
                className="btn ghost sm"
                title="Keep it in the list (dimmed) as seen — for suggestions you're aware of but not acting on yet"
                onClick={() => setStatus(s.id, 'acknowledged')}
              >
                Mark seen
              </button>
            )}
            <button className="btn ghost sm" onClick={() => setStatus(s.id, 'dismissed')}>
              Dismiss
            </button>
          </div>
        </div>
      ))}

      {rows.length > 5 && (
        <div className="card-pad" style={{ borderTop: '1px solid var(--border)' }}>
          <button className="btn ghost sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${rows.length}`}
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}
