// Live Content Calendar: brief → content_plan job → a month of planned
// posts on a real calendar. Same job pipeline as Ad Studio; the wireframe
// Calendar stays as-is for /dev.
//
// Flow:
//   1. Plan brief — client, objective, channels, date range, cadence.
//   2. content_plan job → content_plans row + one content_posts row per
//      slot (per-platform captions, topic, format, image prompt).
//   3. Calendar — month grid of the client's posts; click a post to edit
//      captions / schedule / status. Approve marks it ready for the
//      (later) publish phase; image generation is a later phase too.

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { enqueueJob, useJob } from '../../data/useJob';

type PostStatus = 'draft' | 'approved' | 'scheduled' | 'published' | 'failed';
type PostFormat = 'post' | 'reel' | 'carousel' | 'story';

interface PlanRow {
  id: string;
  client_id: string;
  title: string;
  objective: string;
  channels: string[];
  start_date: string;
  end_date: string;
  posts_per_week: number;
  summary: { overview?: string | null; themes?: Array<{ week: number; theme: string }> } | null;
  status: 'draft' | 'active' | 'archived';
  updated_at: string;
}

type MediaType = 'image' | 'video' | 'link';

interface PostRow {
  id: string;
  plan_id: string | null;
  client_id: string;
  scheduled_date: string;
  scheduled_time: string;
  channels: string[];
  format: PostFormat;
  topic: string;
  caption_fb: string | null;
  caption_ig: string | null;
  image_prompt: string | null;
  image_url: string | null;
  media_type: MediaType;
  video_url: string | null;
  link_url: string | null;
  status: PostStatus;
  publish_at: string | null;
  pending_channels: string[] | null;
  fb_scheduled_post_id: string | null;
  publish_error: string | null;
}

const POSTS_SELECT =
  'id, plan_id, client_id, scheduled_date, scheduled_time, channels, format, topic, caption_fb, caption_ig, image_prompt, image_url, media_type, video_url, link_url, status, publish_at, pending_channels, fb_scheduled_post_id, publish_error';

const CADENCES: Array<{ perWeek: number; label: string }> = [
  { perWeek: 7, label: 'Daily' },
  { perWeek: 5, label: 'Weekdays' },
  { perWeek: 3, label: '3× per week' },
  { perWeek: 2, label: '2× per week' },
  { perWeek: 1, label: 'Weekly' },
];

const FORMATS: PostFormat[] = ['post', 'reel', 'carousel', 'story'];

const STATUS_COLOR: Record<PostStatus, string> = {
  draft: 'var(--border)',
  approved: 'var(--accent)',
  scheduled: 'var(--ai)',
  published: 'var(--green)',
  failed: 'var(--red)',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function fmtIcon(fmt: PostFormat): string {
  if (fmt === 'reel') return 'bolt';
  if (fmt === 'carousel') return 'grid';
  if (fmt === 'story') return 'panel';
  return 'image';
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function LiveCalendar({ clientId: scopedClientId }: { clientId?: string } = {}) {
  const workspace = useWorkspace();
  // Scoped mounts (a client's Calendar tab) pin the client and render
  // inside the client page's own header/content wrapper.
  const embedded = !!scopedClientId;

  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  // null = "All clients" (unscoped view only): every client's posts on one
  // calendar, plans listed with client names, composer picks the client.
  const [clientId, setClientId] = useState<string | null>(scopedClientId ?? null);

  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [posts, setPosts] = useState<PostRow[] | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Composer state
  const [composerOpen, setComposerOpen] = useState(false);
  // In "All clients" mode the composer carries its own client choice.
  const [planClientId, setPlanClientId] = useState<string | null>(null);
  const [objective, setObjective] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [chanFb, setChanFb] = useState(true);
  const [chanIg, setChanIg] = useState(true);
  const [startDate, setStartDate] = useState(() => isoDate(addDays(new Date(), 1)));
  const [endDate, setEndDate] = useState(() => isoDate(addDays(new Date(), 30)));
  const [perWeek, setPerWeek] = useState(7);
  const [postTime, setPostTime] = useState('10:00');
  const [extraContext, setExtraContext] = useState('');

  const [planJobId, setPlanJobId] = useState<string | null>(null);
  const planJob = useJob<{ plan_id: string; posts_created: number; overview?: string }>(planJobId);

  // Calendar cursor + selection
  const today = new Date();
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Client list (names for the picker, chip labels, composer select).
  useEffect(() => {
    if (!supabase || !workspace) return;
    supabase
      .from('clients')
      .select('id, name')
      .eq('workspace_id', workspace.id)
      .order('name')
      .then(({ data }) => {
        const rows = (data ?? []) as Array<{ id: string; name: string }>;
        setClients(rows);
        setPlanClientId((prev) => prev ?? rows[0]?.id ?? null);
      });
  }, [workspace?.id]);

  // Plans + posts — one client, or the whole workspace ("All clients").
  useEffect(() => {
    if (!supabase || !workspace) return;
    let cancelled = false;
    const [scopeCol, scopeVal] = clientId
      ? ['client_id', clientId]
      : ['workspace_id', workspace.id];
    supabase
      .from('content_plans')
      .select(
        'id, client_id, title, objective, channels, start_date, end_date, posts_per_week, summary, status, updated_at',
      )
      .eq(scopeCol, scopeVal)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as unknown as PlanRow[];
        setPlans(rows);
        setComposerOpen((open) => open || (rows.length === 0 && !!clientId));
      });
    supabase
      .from('content_posts')
      .select(POSTS_SELECT)
      .eq(scopeCol, scopeVal)
      .order('scheduled_date')
      .then(({ data }) => {
        if (!cancelled) setPosts((data ?? []) as unknown as PostRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, workspace?.id, reloadTick]);

  // Plan job finished → reload and jump the calendar to the plan's start.
  useEffect(() => {
    if (!planJob.completed) return;
    setReloadTick((t) => t + 1);
    setComposerOpen(false);
    const start = new Date(`${startDate}T00:00:00`);
    setCursor({ year: start.getFullYear(), month: start.getMonth() });
  }, [planJob.completed]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, PostRow[]>();
    for (const p of posts ?? []) {
      const list = map.get(p.scheduled_date) ?? [];
      list.push(p);
      map.set(p.scheduled_date, list);
    }
    return map;
  }, [posts]);

  const selectedPost = (posts ?? []).find((p) => p.id === selectedId) ?? null;

  // The client a new plan is created for: the pinned/selected one, or the
  // composer's own choice in "All clients" mode.
  const composerClientId = clientId ?? planClientId;

  async function startPlan() {
    if (!workspace || !composerClientId) return;
    setError(null);
    const channels = [chanFb ? 'facebook' : null, chanIg ? 'instagram' : null].filter(Boolean);
    try {
      const id = await enqueueJob({
        type: 'content_plan',
        workspaceId: workspace.id,
        clientId: composerClientId,
        input: {
          objective,
          channels,
          start_date: startDate,
          end_date: endDate,
          posts_per_week: perWeek,
          post_time: postTime,
          additional_context: extraContext,
          ...(sourceUrl.trim() ? { source_url: sourceUrl.trim() } : {}),
        },
      });
      setPlanJobId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function patchPost(id: string, patch: Partial<PostRow>) {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase
      .from('content_posts')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) {
      setError(err.message);
      return;
    }
    setPosts((prev) =>
      prev ? prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) : prev,
    );
  }

  async function deletePost(id: string) {
    if (!supabase) return;
    if (!confirm('Delete this planned post?')) return;
    const { error: err } = await supabase.from('content_posts').delete().eq('id', id);
    if (err) {
      setError(err.message);
      return;
    }
    setSelectedId((s) => (s === id ? null : s));
    setPosts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }

  async function approveAll(planId: string) {
    if (!supabase) return;
    const { error: err } = await supabase
      .from('content_posts')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('plan_id', planId)
      .eq('status', 'draft');
    if (err) {
      setError(err.message);
      return;
    }
    setReloadTick((t) => t + 1);
  }

  async function deletePlan(plan: PlanRow) {
    if (!supabase) return;
    if (!confirm(`Delete "${plan.title || 'this plan'}" and all its posts? This cannot be undone.`)) {
      return;
    }
    const { error: err } = await supabase.from('content_plans').delete().eq('id', plan.id);
    if (err) {
      setError(err.message);
      return;
    }
    setSelectedId(null);
    setReloadTick((t) => t + 1);
  }

  if (!workspace) return null;

  const briefReady = !!composerClientId && objective.trim().length > 0 && (chanFb || chanIg);
  const generating = planJob.running;
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? id;

  // Month grid cells
  const firstDow = new Date(cursor.year, cursor.month, 1).getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cellCount = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const todayStr = isoDate(today);

  const monthCounts = (posts ?? []).filter((p) =>
    p.scheduled_date.startsWith(
      `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`,
    ),
  );

  return (
    <div className={embedded ? 'stack' : 'content wide'}>
      <div className="row between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        {!embedded && (
          <div className="stack gap-4">
            <h1 className="h0">Content Calendar</h1>
            <span className="meta">
              AI-planned Facebook + Instagram posts — all clients at a glance, or one at a time.
            </span>
          </div>
        )}
        <div className="row gap-8">
          {!embedded && clients.length > 0 && (
            <select
              value={clientId ?? ''}
              onChange={(e) => {
                setClientId(e.target.value || null);
                setSelectedId(null);
              }}
              style={fieldStyle}
            >
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn ai" onClick={() => setComposerOpen((o) => !o)}>
            <Icon name="sparkles" size={13} /> {composerOpen ? 'Hide planner' : 'New content plan'}
          </button>
        </div>
      </div>

      {clients.length === 0 && !embedded && (
        <div className="card card-pad meta">Add a client first — plans hang off a client.</div>
      )}

      {/* ---- Plan brief ---- */}
      {composerOpen && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--accent)' }}>
          <div className="card-pad stack gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="h2">Plan a run of posts</span>
            <span className="meta">
              The AI drafts every slot in the range — topics, per-platform captions, and an image
              brief per post — grounded in this client's brand profile and scraped site.
            </span>
          </div>
          <div className="card-pad stack gap-12">
            {!clientId && (
              <label className="stack gap-4" style={{ maxWidth: 280 }}>
                <span className="meta">Client</span>
                <select
                  value={planClientId ?? ''}
                  onChange={(e) => setPlanClientId(e.target.value || null)}
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
            <label className="stack gap-4">
              <span className="meta">What should this content achieve?</span>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g. 'A month of posts building buzz for our summer camps — mix of program highlights, parent testimonials, and early-bird signup pushes.'"
                style={{ ...fieldStyle, minHeight: 80, resize: 'vertical' }}
                disabled={generating}
              />
            </label>
            <div className="row gap-12" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="stack gap-4">
                <span className="meta">Channels</span>
                <div className="row gap-12" style={{ padding: '10px 0' }}>
                  <label className="row gap-6" style={{ alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={chanFb}
                      onChange={(e) => setChanFb(e.target.checked)}
                      disabled={generating}
                    />
                    <span style={{ fontSize: 13 }}>Facebook</span>
                  </label>
                  <label className="row gap-6" style={{ alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={chanIg}
                      onChange={(e) => setChanIg(e.target.checked)}
                      disabled={generating}
                    />
                    <span style={{ fontSize: 13 }}>Instagram</span>
                  </label>
                </div>
              </div>
              <label className="stack gap-4">
                <span className="meta">From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={fieldStyle}
                  disabled={generating}
                />
              </label>
              <label className="stack gap-4">
                <span className="meta">To</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={fieldStyle}
                  disabled={generating}
                />
              </label>
              <label className="stack gap-4">
                <span className="meta">Cadence</span>
                <select
                  value={perWeek}
                  onChange={(e) => setPerWeek(Number(e.target.value))}
                  style={fieldStyle}
                  disabled={generating}
                >
                  {CADENCES.map((c) => (
                    <option key={c.perWeek} value={c.perWeek}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack gap-4">
                <span className="meta">Post at</span>
                <input
                  type="time"
                  value={postTime}
                  onChange={(e) => setPostTime(e.target.value)}
                  style={fieldStyle}
                  disabled={generating}
                />
              </label>
            </div>
            <label className="stack gap-4">
              <span className="meta">
                Build it around a URL (optional — a blog post or offer page; we'll read it)
              </span>
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://yoursite.com/blog/that-post"
                style={fieldStyle}
                disabled={generating}
              />
            </label>
            <label className="stack gap-4">
              <span className="meta">Extra context (optional)</span>
              <input
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="Events, promos, dates to build around, topics to avoid…"
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
              Up to a month of daily posts per plan. Everything lands as editable drafts.
            </span>
            <button className="btn primary" disabled={!briefReady || generating} onClick={startPlan}>
              <Icon name="sparkles" size={13} /> Generate plan →
            </button>
          </div>
        </div>
      )}

      {(planJob.running || planJob.failed) && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          {planJob.running ? (
            <div className="stack gap-6">
              <div className="row between">
                <span className="meta">
                  {planJob.job?.progress_message ?? 'Planning your calendar…'}
                </span>
                <span className="meta">{planJob.displayProgress | 0}%</span>
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
                    width: `${Math.max(planJob.displayProgress, 4)}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    transition: 'width 400ms ease',
                  }}
                />
              </div>
            </div>
          ) : (
            <span className="meta" style={{ color: 'var(--danger, #c33)' }}>
              ⚠ {planJob.job?.error}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="card card-pad meta" style={{ color: 'var(--danger, #c33)', marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {/* ---- Plans list ---- */}
      {(plans?.length ?? 0) > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          {plans!.map((plan, i) => {
            const planPosts = (posts ?? []).filter((p) => p.plan_id === plan.id);
            const drafts = planPosts.filter((p) => p.status === 'draft').length;
            return (
              <div
                key={plan.id}
                className="card-pad row between"
                style={{
                  borderBottom: i < plans!.length - 1 ? '1px solid var(--border)' : 0,
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div className="stack gap-2" style={{ minWidth: 0 }}>
                  <div className="row gap-8">
                    <span style={{ fontWeight: 500 }}>{plan.title || 'Untitled plan'}</span>
                    {!clientId && !embedded && (
                      <span className="pill teal" style={{ fontSize: 10 }}>
                        {clientName(plan.client_id)}
                      </span>
                    )}
                    <span className="pill gray" style={{ fontSize: 10 }}>
                      {planPosts.length} posts
                    </span>
                    {drafts > 0 && (
                      <span className="pill gray" style={{ fontSize: 10 }}>
                        {drafts} draft{drafts === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <span className="meta" style={{ fontSize: 11 }}>
                    {plan.start_date} → {plan.end_date} ·{' '}
                    {CADENCES.find((c) => c.perWeek === plan.posts_per_week)?.label ??
                      `${plan.posts_per_week}/week`}
                    {plan.summary?.overview ? ` — ${plan.summary.overview}` : ''}
                  </span>
                </div>
                <div className="row gap-8" style={{ flexShrink: 0 }}>
                  <button
                    className="btn sm"
                    onClick={() => {
                      const start = new Date(`${plan.start_date}T00:00:00`);
                      setCursor({ year: start.getFullYear(), month: start.getMonth() });
                    }}
                  >
                    View
                  </button>
                  {drafts > 0 && (
                    <button className="btn sm" onClick={() => approveAll(plan.id)}>
                      <Icon name="check" size={12} /> Approve all
                    </button>
                  )}
                  <button className="btn ghost sm" onClick={() => deletePlan(plan)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Month grid ---- */}
      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="row gap-8">
            <button
              className="btn ghost sm"
              onClick={() => {
                setCursor((c) =>
                  c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 },
                );
              }}
            >
              ‹
            </button>
            <span className="h2" style={{ minWidth: 150, textAlign: 'center' }}>
              {monthLabel}
            </span>
            <button
              className="btn ghost sm"
              onClick={() => {
                setCursor((c) =>
                  c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 },
                );
              }}
            >
              ›
            </button>
          </div>
          <span className="meta">
            {monthCounts.length} post{monthCounts.length === 1 ? '' : 's'} this month
          </span>
        </div>
        <div
          className="grid"
          style={{
            // minmax(0,1fr): a long chip title must truncate, not stretch its column
            gridTemplateColumns: 'repeat(7,minmax(0,1fr))',
            background: 'var(--border)',
            gap: 1,
          }}
        >
          {DAYS.map((d) => (
            <div
              key={d}
              style={{
                padding: '8px 12px',
                background: 'var(--bg-1)',
                fontSize: 12,
                color: 'var(--fg-2)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {d}
            </div>
          ))}
          {Array.from({ length: cellCount }, (_, i) => {
            const day = i - firstDow + 1;
            const inMonth = day > 0 && day <= daysInMonth;
            const dateStr = inMonth
              ? `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              : '';
            const dayPosts = inMonth ? postsByDate.get(dateStr) ?? [] : [];
            return (
              <div
                key={i}
                style={{
                  background: 'var(--bg-1)',
                  minHeight: 96,
                  padding: 8,
                  opacity: inMonth ? 1 : 0.35,
                }}
              >
                <div
                  className="meta"
                  style={{
                    fontSize: 11,
                    marginBottom: 6,
                    fontWeight: dateStr === todayStr ? 700 : undefined,
                    color: dateStr === todayStr ? 'var(--accent)' : undefined,
                  }}
                >
                  {inMonth ? day : ''}
                </div>
                <div className="stack gap-4">
                  {dayPosts.map((p) => (
                    <div
                      key={p.id}
                      className="row gap-4"
                      onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                      title={p.topic}
                      style={{
                        padding: '3px 6px',
                        background:
                          selectedId === p.id ? 'rgba(6,182,164,0.1)' : 'var(--bg-2)',
                        borderRadius: 4,
                        border: `1px solid ${STATUS_COLOR[p.status]}`,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon name={fmtIcon(p.format)} size={10} />
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {!clientId && !embedded ? `${clientName(p.client_id)} · ` : ''}
                        {p.topic || '(untitled)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="card-pad row gap-16" style={{ flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
          <span className="meta">Legend:</span>
          {(Object.keys(STATUS_COLOR) as PostStatus[]).map((s) => (
            <span key={s} className="row gap-6" style={{ alignItems: 'center' }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  border: `2px solid ${STATUS_COLOR[s]}`,
                  display: 'inline-block',
                }}
              />
              <span className="meta" style={{ textTransform: 'capitalize' }}>
                {s}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ---- Post editor ---- */}
      {selectedPost && (
        <PostEditor
          key={selectedPost.id}
          post={selectedPost}
          onPatch={(patch) => patchPost(selectedPost.id, patch)}
          onDelete={() => deletePost(selectedPost.id)}
          onClose={() => setSelectedId(null)}
          onReload={() => setReloadTick((t) => t + 1)}
        />
      )}
    </div>
  );
}

/** Edit one planned post: captions per platform, schedule, format,
 * channels, status. Local draft state; Save writes the row. */
function PostEditor({
  post,
  onPatch,
  onDelete,
  onClose,
  onReload,
}: {
  post: PostRow;
  onPatch: (patch: Partial<PostRow>) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  onReload: () => void;
}) {
  const [topic, setTopic] = useState(post.topic);
  const [captionFb, setCaptionFb] = useState(post.caption_fb ?? '');
  const [captionIg, setCaptionIg] = useState(post.caption_ig ?? '');
  const [imagePrompt, setImagePrompt] = useState(post.image_prompt ?? '');
  const [imageUrl, setImageUrl] = useState(post.image_url ?? '');
  const [mediaType, setMediaType] = useState<MediaType>(post.media_type ?? 'image');
  const [videoUrl, setVideoUrl] = useState(post.video_url ?? '');
  const [linkUrl, setLinkUrl] = useState(post.link_url ?? '');
  const [format, setFormat] = useState<PostFormat>(post.format);
  const [date, setDate] = useState(post.scheduled_date);
  const [time, setTime] = useState(post.scheduled_time.slice(0, 5));
  const [fb, setFb] = useState(post.channels.includes('facebook'));
  const [ig, setIg] = useState(post.channels.includes('instagram'));
  const [saving, setSaving] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const dirty =
    topic !== post.topic ||
    captionFb !== (post.caption_fb ?? '') ||
    captionIg !== (post.caption_ig ?? '') ||
    imagePrompt !== (post.image_prompt ?? '') ||
    imageUrl !== (post.image_url ?? '') ||
    mediaType !== (post.media_type ?? 'image') ||
    videoUrl !== (post.video_url ?? '') ||
    linkUrl !== (post.link_url ?? '') ||
    format !== post.format ||
    date !== post.scheduled_date ||
    time !== post.scheduled_time.slice(0, 5) ||
    fb !== post.channels.includes('facebook') ||
    ig !== post.channels.includes('instagram');

  async function save(extra?: Partial<PostRow>) {
    setSaving(true);
    await onPatch({
      topic,
      caption_fb: fb ? captionFb || null : null,
      caption_ig: ig ? captionIg || null : null,
      image_prompt: imagePrompt || null,
      image_url: imageUrl || null,
      media_type: mediaType,
      video_url: videoUrl || null,
      link_url: linkUrl || null,
      format,
      scheduled_date: date,
      scheduled_time: time,
      channels: [fb ? 'facebook' : null, ig ? 'instagram' : null].filter(Boolean) as string[],
      ...extra,
    });
    setSaving(false);
  }

  /** Generate the image from the on-screen brief via the configured
   * provider (Settings → AI → Image generation; xAI by default). The
   * function writes image_url on the row; mirror it locally. */
  async function generateImage() {
    if (!supabase) return;
    setGenBusy(true);
    setGenError(null);
    const { data, error } = await supabase.functions.invoke('generate-post-image', {
      body: { content_post_id: post.id, ...(imagePrompt.trim() ? { prompt: imagePrompt.trim() } : {}) },
    });
    setGenBusy(false);
    if (error || !data?.ok) {
      let text: string | null = (data?.error as string | undefined) ?? null;
      if (!text && error && 'context' in error) {
        try {
          text = (await (error.context as Response).json())?.error ?? null;
        } catch {
          /* not JSON */
        }
      }
      setGenError(text ?? error?.message ?? 'Image generation failed');
      return;
    }
    setImageUrl(data.image_url as string);
    onPatch({ image_url: data.image_url as string }); // sync local rows state
  }

  return (
    <div className="card" style={{ marginTop: 16, borderLeft: '3px solid var(--accent)' }}>
      <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="row gap-8">
          <Icon name={fmtIcon(format)} size={14} />
          <span className="h2">{post.scheduled_date}</span>
          <span
            className="pill gray"
            style={{ fontSize: 10, textTransform: 'capitalize', borderColor: STATUS_COLOR[post.status] }}
          >
            {post.status}
          </span>
        </div>
        <button className="btn ghost sm" onClick={onClose}>
          <Icon name="close" size={12} /> Close
        </button>
      </div>

      <div className="card-pad stack gap-12">
        <div className="row gap-12" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="stack gap-4" style={{ flex: 1, minWidth: 220 }}>
            <span className="meta">Topic</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} style={fieldStyle} />
          </label>
          <label className="stack gap-4">
            <span className="meta">Format</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as PostFormat)}
              style={fieldStyle}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f[0].toUpperCase() + f.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="stack gap-4">
            <span className="meta">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
          </label>
          <label className="stack gap-4">
            <span className="meta">Time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={fieldStyle} />
          </label>
          <div className="row gap-12" style={{ padding: '10px 0' }}>
            <label className="row gap-6" style={{ alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={fb} onChange={(e) => setFb(e.target.checked)} />
              <span style={{ fontSize: 13 }}>FB</span>
            </label>
            <label className="row gap-6" style={{ alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={ig} onChange={(e) => setIg(e.target.checked)} />
              <span style={{ fontSize: 13 }}>IG</span>
            </label>
          </div>
        </div>

        <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
          {fb && (
            <label className="stack gap-4" style={{ flex: 1, minWidth: 260 }}>
              <span className="meta">Facebook caption</span>
              <textarea
                value={captionFb}
                onChange={(e) => setCaptionFb(e.target.value)}
                style={{ ...fieldStyle, minHeight: 120, resize: 'vertical' }}
              />
            </label>
          )}
          {ig && (
            <label className="stack gap-4" style={{ flex: 1, minWidth: 260 }}>
              <span className="meta">Instagram caption</span>
              <textarea
                value={captionIg}
                onChange={(e) => setCaptionIg(e.target.value)}
                style={{ ...fieldStyle, minHeight: 120, resize: 'vertical' }}
              />
            </label>
          )}
        </div>

        <div className="row gap-12" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <label className="stack gap-4">
            <span className="meta">Media</span>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaType)}
              style={fieldStyle}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="link">Link</option>
            </select>
          </label>

          {mediaType === 'image' && (
            <>
              <label className="stack gap-4" style={{ flex: 1, minWidth: 240 }}>
                <span className="meta">Image brief (what the AI should generate)</span>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }}
                />
                <button
                  className="btn ai sm"
                  disabled={genBusy || !imagePrompt.trim()}
                  onClick={generateImage}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <Icon name="sparkles" size={12} />{' '}
                  {genBusy ? 'Generating…' : imageUrl ? 'Regenerate image' : 'Generate image'}
                </button>
                {genError && (
                  <span className="meta" style={{ fontSize: 11, color: 'var(--danger, #c33)' }}>
                    ⚠ {genError}
                  </span>
                )}
              </label>
              <label className="stack gap-4" style={{ flex: 1, minWidth: 240 }}>
                <span className="meta">
                  Image URL (public — required for Instagram; generate one or paste an asset URL)
                </span>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…/photo.jpg"
                  style={fieldStyle}
                />
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="post preview"
                    style={{ maxHeight: 120, borderRadius: 8, marginTop: 4, objectFit: 'cover' }}
                    onError={(e) => ((e.currentTarget.style.display = 'none'))}
                  />
                )}
              </label>
            </>
          )}

          {mediaType === 'video' && (
            <label className="stack gap-4" style={{ flex: 1, minWidth: 260 }}>
              <span className="meta">
                Video URL (public MP4/MOV — Facebook posts it directly; Instagram publishes it as a
                Reel, ≤90s)
              </span>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://…/clip.mp4"
                style={fieldStyle}
              />
            </label>
          )}

          {mediaType === 'link' && (
            <label className="stack gap-4" style={{ flex: 1, minWidth: 260 }}>
              <span className="meta">
                Link URL — posts to Facebook with a link preview. Instagram doesn't support link
                posts (turn IG off for this one).
              </span>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://yoursite.com/blog/that-post"
                style={fieldStyle}
              />
            </label>
          )}
        </div>
      </div>

      <div
        className="card-pad row between"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}
      >
        {post.status === 'scheduled' ? (
          <span className="meta">Scheduled — cancel the schedule below to edit or delete.</span>
        ) : (
          <>
            <button className="btn ghost sm" onClick={onDelete} disabled={saving}>
              Delete post
            </button>
            <div className="row gap-8">
              <button className="btn" disabled={saving || !dirty} onClick={() => save()}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {post.status === 'draft' ? (
                <button className="btn primary" disabled={saving} onClick={() => save({ status: 'approved' })}>
                  <Icon name="check" size={12} /> Approve
                </button>
              ) : (
                (post.status === 'approved' || post.status === 'failed') && (
                  <button className="btn" disabled={saving} onClick={() => save({ status: 'draft' })}>
                    Back to draft
                  </button>
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* ---- Publish / schedule (organic) ---- */}
      {post.status !== 'draft' && (
        <PublishPanel
          post={post}
          blocker={
            dirty
              ? 'Save your changes first'
              : mediaType === 'image' && ig && !imageUrl.trim()
              ? 'Instagram is selected but this post has no image — generate or paste one'
              : mediaType === 'video' && !videoUrl.trim()
              ? 'This is a video post but it has no video URL'
              : mediaType === 'link' && !linkUrl.trim()
              ? 'This is a link post but it has no link URL'
              : mediaType === 'link' && ig
              ? "Instagram doesn't support link posts — turn IG off for this one"
              : null
          }
          onReload={onReload}
        />
      )}
    </div>
  );
}

/** Unwrap a functions.invoke failure into the function's real message —
 * a non-2xx throws a generic FunctionsHttpError; the useful text ("No Meta
 * access token configured…") is in the response body on error.context. */
async function invokeErrorText(data: any, error: unknown): Promise<string> {
  let text: string | null = (data?.error as string | undefined) ?? null;
  if (!text && error && typeof error === 'object' && 'context' in error) {
    try {
      text = (await ((error as { context: Response }).context).json())?.error ?? null;
    } catch {
      /* body not JSON — fall through */
    }
  }
  return text ?? (error as Error | null)?.message ?? 'Publish failed';
}

/** Publish an approved post immediately, or schedule it for its date+time:
 * Facebook is scheduled NATIVELY (shows in Meta's Content Library →
 * Scheduled and Meta publishes it); Instagram has no API scheduling, so
 * CanopyStudio's cron publishes it when the moment arrives. */
function PublishPanel({
  post,
  blocker,
  onReload,
}: {
  post: PostRow;
  /** Why publishing is currently blocked (unsaved edits, missing media…), or null. */
  blocker: string | null;
  onReload: () => void;
}) {
  const [confirming, setConfirming] = useState<'now' | 'schedule' | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const carouselStory = post.format === 'carousel' || post.format === 'story';
  const wantFb = post.channels.includes('facebook');
  const wantIg = post.channels.includes('instagram');

  // The scheduled instant, interpreted in THIS browser's timezone — the
  // only place that knows what "10:00" was meant to be.
  const publishAtLocal = new Date(`${post.scheduled_date}T${post.scheduled_time}`);
  const publishAtLabel = publishAtLocal.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const tooSoon = publishAtLocal.getTime() - Date.now() < 10 * 60_000;
  const scheduleBlocker =
    blocker ??
    (tooSoon
      ? `The scheduled time (${publishAtLabel}) is in the past or under 10 minutes away — move it, or use Post now`
      : null);
  const publishedBlocker =
    post.status === 'published' ? 'Already published — duplicate it as a new post to re-send' : null;

  async function invoke(body: Record<string, unknown>, okText: (data: any) => string) {
    if (!supabase) return;
    setBusy(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke('publish-meta-post', {
      body: { content_post_id: post.id, ...body },
    });
    setBusy(false);
    setConfirming(null);
    if (error || !data?.ok) {
      setResult({ ok: false, text: await invokeErrorText(data, error) });
      onReload();
      return;
    }
    setResult({ ok: true, text: okText(data) });
    onReload();
  }

  const postNow = () =>
    invoke({ mode: 'now' }, (data) => {
      const chans = (data.results ?? [])
        .filter((r: { ok: boolean }) => r.ok)
        .map((r: { channel: string }) => r.channel)
        .join(' + ');
      return data.status === 'partial'
        ? `Partially published (${chans}). ${data.error ?? ''}`
        : `Published live to ${chans}.`;
    });

  const schedule = () =>
    invoke(
      { mode: 'schedule', publish_at: publishAtLocal.toISOString() },
      (data) => `Scheduled for ${publishAtLabel}. ${data.note ?? ''}`,
    );

  const cancel = () => invoke({ mode: 'cancel' }, (data) => data.note ?? 'Schedule canceled.');

  // ---- Scheduled state: info + cancel ----
  if (post.status === 'scheduled') {
    return (
      <div className="card-pad stack gap-8" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="stack gap-2" style={{ maxWidth: 560 }}>
            <div className="row gap-8">
              <Icon name="calendar" size={13} />
              <span className="h2">Scheduled for {publishAtLabel}</span>
            </div>
            <span className="meta" style={{ fontSize: 11 }}>
              {post.fb_scheduled_post_id
                ? "Facebook: queued in Meta itself — it's visible in the Page's Content Library → Scheduled and Meta publishes it. "
                : ''}
              {(post.pending_channels ?? []).includes('instagram')
                ? 'Instagram: has no API scheduling, so CanopyStudio publishes it within ~5 minutes of the time (it will not appear in Meta’s scheduled list).'
                : ''}
            </span>
          </div>
          <button className="btn" disabled={busy} onClick={cancel}>
            {busy ? 'Canceling…' : 'Cancel schedule'}
          </button>
        </div>
        {result && (
          <div
            className="meta"
            style={{ fontSize: 12, color: result.ok ? 'var(--green)' : 'var(--danger, #c33)' }}
          >
            {result.ok ? '✓ ' : '⚠ '}
            {result.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card-pad stack gap-8" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="stack gap-2" style={{ maxWidth: 520 }}>
          <div className="row gap-8">
            <Icon name="bolt" size={13} />
            <span className="h2">Publish</span>
            {post.status === 'published' && (
              <span className="pill green" style={{ fontSize: 10 }}>
                Published
              </span>
            )}
          </div>
          <span className="meta" style={{ fontSize: 11 }}>
            <strong>Schedule</strong> queues it for {publishAtLabel} —{' '}
            {wantFb ? "Facebook lands in Meta's own scheduled queue" : ''}
            {wantFb && wantIg ? '; ' : ''}
            {wantIg ? 'Instagram is published by CanopyStudio at the time (no API scheduling exists)' : ''}
            . <strong>Post now</strong> publishes immediately and live.
          </span>
          {carouselStory && (
            <span className="meta" style={{ fontSize: 11, color: 'var(--ai)' }}>
              Note: {post.format} publishing needs the multi-image / stories flow — this posts a
              single image/text. Polls & link stickers on Stories must be added manually in the app.
            </span>
          )}
        </div>
        <div className="row gap-8" style={{ alignItems: 'center' }}>
          {confirming === null ? (
            <>
              <button
                className="btn primary"
                disabled={busy || !!scheduleBlocker || !!publishedBlocker}
                onClick={() => setConfirming('schedule')}
                title={publishedBlocker ?? scheduleBlocker ?? undefined}
              >
                <Icon name="calendar" size={12} /> Schedule →
              </button>
              <button
                className="btn"
                disabled={busy || !!blocker || !!publishedBlocker}
                onClick={() => setConfirming('now')}
                title={publishedBlocker ?? blocker ?? undefined}
              >
                <Icon name="bolt" size={12} /> Post now →
              </button>
            </>
          ) : (
            <>
              <button
                className="btn primary"
                disabled={busy}
                onClick={confirming === 'now' ? postNow : schedule}
              >
                {busy
                  ? 'Working…'
                  : confirming === 'now'
                  ? 'Confirm — publish live'
                  : `Confirm — schedule for ${publishAtLabel}`}
              </button>
              <button className="btn ghost" disabled={busy} onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      {(publishedBlocker ?? blocker ?? scheduleBlocker) && (
        <span className="meta" style={{ fontSize: 11 }}>
          {publishedBlocker ?? blocker ?? scheduleBlocker}
        </span>
      )}
      {result && (
        <div
          className="meta"
          style={{ fontSize: 12, color: result.ok ? 'var(--green)' : 'var(--danger, #c33)' }}
        >
          {result.ok ? '✓ ' : '⚠ '}
          {result.text}
        </div>
      )}
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
