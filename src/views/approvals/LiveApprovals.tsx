import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { invokeErrorText } from '../../lib/invokeError';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

/**
 * Live Approvals — the one-click sign-off inbox over data that already
 * exists: draft content_posts (organic FB/IG), draft generations (ad
 * copy), and content_plans with drafts remaining.
 *
 * Safety model, deliberately asymmetric:
 *  - Organic posts have NO paused state — "Approve & Post now" goes live
 *    immediately, so it's confirm-per-item, never bulk.
 *  - Meta ads are ALWAYS created status=PAUSED by publish-meta-ad, so
 *    "Publish (paused)" is single-click safe; the final go-live happens
 *    inside Meta after a human look.
 *  - Plan-level bulk approval only flips draft → approved (no publishing).
 */

interface DraftPost {
  id: string;
  client_id: string;
  plan_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  channels: string[];
  media_type: string;
  topic: string;
  caption_fb: string | null;
  caption_ig: string | null;
  image_url: string | null;
  status: string;
}

interface DraftGeneration {
  id: string;
  client_id: string;
  campaign_name: string;
  campaign_idea: string;
  medium: string;
  updated_at: string;
  meta_output: unknown;
}

interface PlanWithDrafts {
  id: string;
  client_id: string;
  objective: string;
  draftCount: number;
}

export function LiveApprovals() {
  const workspace = useWorkspace();
  const [clients, setClients] = useState<Record<string, string>>({});
  const [posts, setPosts] = useState<DraftPost[]>([]);
  const [gens, setGens] = useState<DraftGeneration[]>([]);
  const [plans, setPlans] = useState<PlanWithDrafts[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // row id being acted on
  const [confirmPost, setConfirmPost] = useState<DraftPost | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) return;
      setLoading(true);
      const [clientsRes, postsRes, gensRes, plansRes] = await Promise.all([
        supabase.from('clients').select('id, name').eq('workspace_id', workspace.id),
        supabase
          .from('content_posts')
          .select(
            'id, client_id, plan_id, scheduled_date, scheduled_time, channels, media_type, topic, caption_fb, caption_ig, image_url, status',
          )
          .eq('workspace_id', workspace.id)
          .eq('status', 'draft')
          .order('scheduled_date', { ascending: true })
          .limit(200),
        supabase
          .from('generations')
          .select('id, client_id, campaign_name, campaign_idea, medium, updated_at, meta_output')
          .eq('workspace_id', workspace.id)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(50),
        supabase
          .from('content_plans')
          .select('id, client_id, objective')
          .eq('workspace_id', workspace.id)
          .neq('status', 'archived')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (cancelled) return;
      const cmap: Record<string, string> = {};
      for (const c of clientsRes.data ?? []) cmap[c.id as string] = c.name as string;
      setClients(cmap);
      const draftPosts = (postsRes.data ?? []) as unknown as DraftPost[];
      setPosts(draftPosts);
      setGens((gensRes.data ?? []) as unknown as DraftGeneration[]);
      // Plans section only lists plans that still have draft posts.
      const draftsByPlan = new Map<string, number>();
      for (const p of draftPosts) {
        if (p.plan_id) draftsByPlan.set(p.plan_id, (draftsByPlan.get(p.plan_id) ?? 0) + 1);
      }
      setPlans(
        ((plansRes.data ?? []) as { id: string; client_id: string; objective: string }[])
          .filter((pl) => draftsByPlan.has(pl.id))
          .map((pl) => ({ ...pl, draftCount: draftsByPlan.get(pl.id)! })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id, bump]);

  const reload = () => setBump((b) => b + 1);
  const setMsg = (id: string, ok: boolean, text: string) =>
    setRowMsg((m) => ({ ...m, [id]: { ok, text } }));

  // ---- Post actions -------------------------------------------------------

  async function approvePost(post: DraftPost) {
    if (!supabase) return;
    setBusy(post.id);
    const { error } = await supabase
      .from('content_posts')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', post.id);
    setBusy(null);
    if (error) return setMsg(post.id, false, error.message);
    setMsg(post.id, true, 'Approved — schedule or post it from the calendar, or right here.');
    reload();
  }

  /** Approve (if needed) then hand off to publish-meta-post. */
  async function approveThen(post: DraftPost, body: Record<string, unknown>, okText: string) {
    if (!supabase) return;
    setBusy(post.id);
    setConfirmPost(null);
    const { error: updErr } = await supabase
      .from('content_posts')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', post.id);
    if (updErr) {
      setBusy(null);
      return setMsg(post.id, false, updErr.message);
    }
    const { data, error } = await supabase.functions.invoke('publish-meta-post', {
      body: { content_post_id: post.id, ...body },
    });
    setBusy(null);
    if (error || !data?.ok) {
      setMsg(post.id, false, await invokeErrorText(data, error));
      reload();
      return;
    }
    setMsg(post.id, true, okText);
    reload();
  }

  function schedulableAt(post: DraftPost): { at: Date; label: string; tooSoon: boolean } {
    const at = new Date(`${post.scheduled_date}T${post.scheduled_time}`);
    return {
      at,
      label: at.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      tooSoon: at.getTime() - Date.now() < 10 * 60_000,
    };
  }

  // ---- Generation actions -------------------------------------------------

  const [budgets, setBudgets] = useState<Record<string, string>>({});

  async function markFinal(gen: DraftGeneration) {
    if (!supabase) return;
    setBusy(gen.id);
    const { error } = await supabase
      .from('generations')
      .update({ status: 'final', updated_at: new Date().toISOString() })
      .eq('id', gen.id);
    setBusy(null);
    if (error) return setMsg(gen.id, false, error.message);
    reload();
  }

  async function publishAdPaused(gen: DraftGeneration) {
    if (!supabase) return;
    const budget = Number(budgets[gen.id] ?? '10');
    if (!Number.isFinite(budget) || budget < 1) {
      return setMsg(gen.id, false, 'Enter a daily budget of at least $1.');
    }
    setBusy(gen.id);
    const { data, error } = await supabase.functions.invoke('publish-meta-ad', {
      body: { generation_id: gen.id, daily_budget_cents: Math.round(budget * 100) },
    });
    setBusy(null);
    if (error || !data?.ok) {
      setMsg(gen.id, false, await invokeErrorText(data, error));
      return;
    }
    setMsg(gen.id, true, 'Created in Meta — PAUSED. Review and turn it on in Ads Manager.');
    reload();
  }

  // ---- Plan actions -------------------------------------------------------

  async function approvePlan(plan: PlanWithDrafts) {
    if (!supabase) return;
    setBusy(plan.id);
    const { error } = await supabase
      .from('content_posts')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('plan_id', plan.id)
      .eq('status', 'draft');
    setBusy(null);
    if (error) return setMsg(plan.id, false, error.message);
    setMsg(plan.id, true, `Approved ${plan.draftCount} posts. Publishing stays per-post.`);
    reload();
  }

  // ---- Render --------------------------------------------------------------

  const totalPending = posts.length + gens.length;

  if (loading) {
    return (
      <div className="content wide">
        <span className="meta">Loading…</span>
      </div>
    );
  }

  return (
    <div className="content wide">
      <div className="stack gap-4" style={{ marginBottom: 16 }}>
        <h1 className="h0">Approvals</h1>
        <span className="meta">
          {totalPending === 0
            ? 'Nothing waiting for sign-off.'
            : `${posts.length} draft post${posts.length === 1 ? '' : 's'} · ${gens.length} ad draft${gens.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {plans.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="h2">Content plans with drafts</span>
          </div>
          {plans.map((pl) => (
            <div key={pl.id} className="card-pad row between" style={{ borderBottom: '1px solid var(--border)', gap: 12 }}>
              <div className="stack gap-2" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {clients[pl.client_id] ?? pl.client_id} — {pl.objective || 'Content plan'}
                </span>
                <span className="meta">{pl.draftCount} draft posts in this plan</span>
                {rowMsg[pl.id] && (
                  <span className="meta" style={{ color: rowMsg[pl.id].ok ? 'var(--accent)' : 'var(--danger, #c33)' }}>
                    {rowMsg[pl.id].text}
                  </span>
                )}
              </div>
              <button className="btn sm" disabled={busy === pl.id} onClick={() => approvePlan(pl)}>
                {busy === pl.id ? 'Approving…' : `Approve all ${pl.draftCount}`}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Draft posts</span>
        </div>
        {posts.length === 0 && (
          <div className="card-pad">
            <span className="meta">No draft posts — plan content from the Calendar.</span>
          </div>
        )}
        {posts.map((post) => {
          const sched = schedulableAt(post);
          const caption = post.caption_fb || post.caption_ig || '';
          return (
            <div key={post.id} className="card-pad stack gap-6" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div className="row gap-10" style={{ minWidth: 0, alignItems: 'flex-start' }}>
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt=""
                      style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      className="row"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 6,
                        background: 'var(--bg-2)',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={post.media_type === 'video' ? 'bolt' : 'image'} size={16} />
                    </div>
                  )}
                  <div className="stack gap-2" style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {clients[post.client_id] ?? post.client_id} · {post.topic || 'Untitled post'}
                    </span>
                    <span className="meta">
                      {sched.label} · {post.channels.join(' + ')} · {post.media_type}
                    </span>
                    {caption && (
                      <span className="meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>
                        {caption}
                      </span>
                    )}
                  </div>
                </div>
                <div className="row gap-6" style={{ flexShrink: 0 }}>
                  <button className="btn sm" disabled={busy === post.id} onClick={() => approvePost(post)}>
                    Approve
                  </button>
                  <button
                    className="btn sm"
                    disabled={busy === post.id || sched.tooSoon}
                    title={
                      sched.tooSoon
                        ? `${sched.label} is in the past or under 10 minutes away — adjust it in the calendar or use Post now`
                        : `FB schedules natively in Meta; IG publishes via CanopyStudio at ${sched.label}`
                    }
                    onClick={() =>
                      approveThen(
                        post,
                        { mode: 'schedule', publish_at: sched.at.toISOString() },
                        `Approved & scheduled for ${sched.label}.`,
                      )
                    }
                  >
                    Approve &amp; Schedule
                  </button>
                  <button
                    className="btn primary sm"
                    disabled={busy === post.id}
                    onClick={() => setConfirmPost(post)}
                  >
                    {busy === post.id ? 'Working…' : 'Approve & Post now'}
                  </button>
                </div>
              </div>
              {rowMsg[post.id] && (
                <span className="meta" style={{ color: rowMsg[post.id].ok ? 'var(--accent)' : 'var(--danger, #c33)' }}>
                  {rowMsg[post.id].ok ? '✓ ' : '⚠ '}
                  {rowMsg[post.id].text}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Ad drafts</span>
        </div>
        {gens.length === 0 && (
          <div className="card-pad">
            <span className="meta">No saved ad drafts — generate copy in Ad Studio and save it.</span>
          </div>
        )}
        {gens.map((gen) => (
          <div key={gen.id} className="card-pad stack gap-6" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
              <div className="stack gap-2" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {clients[gen.client_id] ?? gen.client_id} · {gen.campaign_name || gen.campaign_idea || 'Saved generation'}
                </span>
                <span className="meta">
                  {gen.medium} · saved {new Date(gen.updated_at).toLocaleDateString()}
                </span>
              </div>
              <div className="row gap-6" style={{ flexShrink: 0, alignItems: 'center' }}>
                <button className="btn sm" disabled={busy === gen.id} onClick={() => markFinal(gen)}>
                  Mark final
                </button>
                {gen.medium !== 'GOOGLE_ADS' && (
                  <>
                    <label className="row gap-4 meta" style={{ alignItems: 'center' }}>
                      $
                      <input
                        type="number"
                        min={1}
                        value={budgets[gen.id] ?? '10'}
                        onChange={(e) => setBudgets((b) => ({ ...b, [gen.id]: e.target.value }))}
                        style={{
                          width: 64,
                          background: 'var(--bg-1)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--fg)',
                          padding: '4px 6px',
                          font: 'inherit',
                        }}
                      />
                      /day
                    </label>
                    <button
                      className="btn primary sm"
                      disabled={busy === gen.id}
                      title="Creates campaign, ad set, and ad in Meta — always PAUSED. You flip it live in Ads Manager."
                      onClick={() => publishAdPaused(gen)}
                    >
                      {busy === gen.id ? 'Publishing…' : 'Publish to Meta (paused)'}
                    </button>
                  </>
                )}
              </div>
            </div>
            {rowMsg[gen.id] && (
              <span className="meta" style={{ color: rowMsg[gen.id].ok ? 'var(--accent)' : 'var(--danger, #c33)' }}>
                {rowMsg[gen.id].ok ? '✓ ' : '⚠ '}
                {rowMsg[gen.id].text}
              </span>
            )}
          </div>
        ))}
      </div>

      {confirmPost && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
          }}
          onClick={() => setConfirmPost(null)}
        >
          <div className="card card-pad stack gap-10" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <span className="h2">Post now — this goes live immediately</span>
            <span className="meta">
              "{confirmPost.topic || 'This post'}" publishes to{' '}
              <strong>{confirmPost.channels.join(' + ')}</strong> for{' '}
              <strong>{clients[confirmPost.client_id] ?? confirmPost.client_id}</strong> the moment
              you confirm. Organic posts have no paused state.
            </span>
            <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
              <button className="btn sm" onClick={() => setConfirmPost(null)}>
                Cancel
              </button>
              <button
                className="btn primary sm"
                onClick={() =>
                  approveThen(confirmPost, { mode: 'now' }, 'Published live. See the Publishing Queue for the receipt.')
                }
              >
                Yes, post it now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
