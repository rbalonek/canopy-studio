import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { invokeErrorText } from '../../lib/invokeError';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

/**
 * Live Publishing Queue: what's scheduled to go out, what went out, and
 * what failed — content_posts (scheduled/failed) merged with the
 * post_publishes + ad_publishes audit trails. Cancel uses publish-meta-post
 * mode 'cancel' (also deletes the native FB scheduled post). A failed post
 * is deliberately NOT one-click retryable here: its error names what DID
 * go out, so re-sending must be a conscious choice — "Re-approve" returns
 * it to the Approvals inbox instead.
 */

interface ScheduledPost {
  id: string;
  client_id: string;
  topic: string;
  channels: string[];
  publish_at: string | null;
  pending_channels: string[];
  fb_scheduled_post_id: string | null;
  status: string;
  publish_error: string | null;
  scheduled_date: string;
  scheduled_time: string;
}

interface AuditRow {
  id: string;
  kind: 'post' | 'ad';
  client_id: string;
  label: string;
  where: string;
  status: string;
  error: string | null;
  at: string;
}

export function LivePublishQueue() {
  const workspace = useWorkspace();
  const [clients, setClients] = useState<Record<string, string>>({});
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [failed, setFailed] = useState<ScheduledPost[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) return;
      setLoading(true);
      const postCols =
        'id, client_id, topic, channels, publish_at, pending_channels, fb_scheduled_post_id, status, publish_error, scheduled_date, scheduled_time';
      const [clientsRes, schedRes, failedRes, postPubRes, adPubRes, genRes] = await Promise.all([
        supabase.from('clients').select('id, name').eq('workspace_id', workspace.id),
        supabase
          .from('content_posts')
          .select(postCols)
          .eq('workspace_id', workspace.id)
          .eq('status', 'scheduled')
          .order('publish_at', { ascending: true })
          .limit(100),
        supabase
          .from('content_posts')
          .select(postCols)
          .eq('workspace_id', workspace.id)
          .eq('status', 'failed')
          .order('updated_at', { ascending: false })
          .limit(50),
        supabase
          .from('post_publishes')
          .select('id, client_id, content_post_id, channels, status, error, created_at')
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('ad_publishes')
          .select('id, client_id, generation_id, ad_account_id, status, error, created_at')
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('generations')
          .select('id, campaign_name')
          .eq('workspace_id', workspace.id)
          .limit(200),
      ]);
      if (cancelled) return;
      const cmap: Record<string, string> = {};
      for (const c of clientsRes.data ?? []) cmap[c.id as string] = c.name as string;
      setClients(cmap);
      setScheduled((schedRes.data ?? []) as unknown as ScheduledPost[]);
      setFailed((failedRes.data ?? []) as unknown as ScheduledPost[]);

      const genNames = new Map<string, string>();
      for (const g of genRes.data ?? []) genNames.set(g.id as string, (g.campaign_name as string) || 'Ad');

      const rows: AuditRow[] = [
        ...((postPubRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: r.id as string,
          kind: 'post' as const,
          client_id: r.client_id as string,
          label: 'Organic post',
          where: ((r.channels as string[]) ?? []).join(' + ') || 'FB/IG',
          status: r.status as string,
          error: (r.error as string | null) ?? null,
          at: r.created_at as string,
        })),
        ...((adPubRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: r.id as string,
          kind: 'ad' as const,
          client_id: r.client_id as string,
          label: genNames.get(r.generation_id as string) ?? 'Meta ad',
          where: `Meta Ads · ${r.ad_account_id as string}`,
          status: r.status as string,
          error: (r.error as string | null) ?? null,
          at: r.created_at as string,
        })),
      ].sort((a, b) => (a.at < b.at ? 1 : -1));
      setAudit(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id, bump]);

  const reload = () => setBump((b) => b + 1);
  const setMsg = (id: string, ok: boolean, text: string) =>
    setRowMsg((m) => ({ ...m, [id]: { ok, text } }));

  async function cancelSchedule(post: ScheduledPost) {
    if (!supabase) return;
    setBusy(post.id);
    const { data, error } = await supabase.functions.invoke('publish-meta-post', {
      body: { content_post_id: post.id, mode: 'cancel' },
    });
    setBusy(null);
    if (error || !data?.ok) {
      setMsg(post.id, false, await invokeErrorText(data, error));
      return;
    }
    setMsg(post.id, true, 'Canceled — the post is back to approved.');
    reload();
  }

  async function reApprove(post: ScheduledPost) {
    if (!supabase) return;
    setBusy(post.id);
    const { error } = await supabase
      .from('content_posts')
      .update({ status: 'approved', publish_error: null, updated_at: new Date().toISOString() })
      .eq('id', post.id);
    setBusy(null);
    if (error) return setMsg(post.id, false, error.message);
    setMsg(post.id, true, 'Back to approved — send it again from Approvals or the calendar.');
    reload();
  }

  function statusTag(status: string) {
    const color =
      status === 'published' || status === 'paused_live'
        ? 'var(--accent)'
        : status === 'failed'
          ? 'var(--danger, #c33)'
          : status === 'partial'
            ? 'var(--warning-600, #d97706)'
            : 'var(--fg-2)';
    return (
      <span className="tag" style={{ color }}>
        {status === 'paused_live' ? 'created (paused)' : status}
      </span>
    );
  }

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
        <h1 className="h0">Publishing Queue</h1>
        <span className="meta">
          {scheduled.length} scheduled · {failed.length} failed · {audit.length} recent publish
          {audit.length === 1 ? '' : 'es'}
        </span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Scheduled</span>
        </div>
        {scheduled.length === 0 && (
          <div className="card-pad">
            <span className="meta">Nothing scheduled. Approve & schedule posts from Approvals or the calendar.</span>
          </div>
        )}
        {scheduled.map((post) => {
          const when = post.publish_at
            ? new Date(post.publish_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : `${post.scheduled_date} ${post.scheduled_time}`;
          return (
            <div key={post.id} className="card-pad stack gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div className="stack gap-2" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {clients[post.client_id] ?? post.client_id} · {post.topic || 'Post'}
                  </span>
                  <span className="meta">
                    {when} · {post.channels.join(' + ')}
                    {post.fb_scheduled_post_id ? ' · FB queued natively in Meta' : ''}
                    {post.pending_channels.includes('instagram')
                      ? ' · IG publishes via CanopyStudio cron'
                      : ''}
                  </span>
                </div>
                <button className="btn sm" disabled={busy === post.id} onClick={() => cancelSchedule(post)}>
                  {busy === post.id ? 'Canceling…' : 'Cancel'}
                </button>
              </div>
              {rowMsg[post.id] && (
                <span className="meta" style={{ color: rowMsg[post.id].ok ? 'var(--accent)' : 'var(--danger, #c33)' }}>
                  {rowMsg[post.id].text}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {failed.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="h2">Failed</span>
          </div>
          {failed.map((post) => (
            <div key={post.id} className="card-pad stack gap-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="row between" style={{ gap: 12, flexWrap: 'wrap' }}>
                <div className="stack gap-2" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>
                    {clients[post.client_id] ?? post.client_id} · {post.topic || 'Post'}
                  </span>
                  <span className="meta" style={{ color: 'var(--danger, #c33)' }}>
                    {post.publish_error ?? 'Publish failed'}
                  </span>
                  <span className="meta" style={{ fontSize: 11 }}>
                    Read the error before re-sending — a partial failure means one channel already
                    went out.
                  </span>
                </div>
                <button className="btn sm" disabled={busy === post.id} onClick={() => reApprove(post)}>
                  Re-approve
                </button>
              </div>
              {rowMsg[post.id] && (
                <span className="meta" style={{ color: rowMsg[post.id].ok ? 'var(--accent)' : 'var(--danger, #c33)' }}>
                  {rowMsg[post.id].text}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Recent activity</span>
        </div>
        {audit.length === 0 && (
          <div className="card-pad">
            <span className="meta">No publishes yet.</span>
          </div>
        )}
        {audit.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th>What</th>
                <th>Client</th>
                <th>Where</th>
                <th>When</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={`${row.kind}-${row.id}`}>
                  <td>{row.label}</td>
                  <td>{clients[row.client_id] ?? row.client_id}</td>
                  <td className="meta">{row.where}</td>
                  <td className="meta">
                    {new Date(row.at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <div className="stack gap-2">
                      {statusTag(row.status)}
                      {row.error && (
                        <span className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
                          {row.error}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
