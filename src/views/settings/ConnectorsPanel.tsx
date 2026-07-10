// Settings → Connections: Resend (email) + Slack (webhook) config.
// Owner-only by RLS — non-owners see a read-back failure note instead of
// the form. "Send test" round-trips through the test-connector function.

import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { inputStyle } from './shared';

type ConnectorRow = {
  resend_from_email: string | null;
  resend_reply_to: string | null;
  slack_webhook_url: string | null;
};

export function ConnectorsPanel() {
  const workspace = useWorkspace();
  const [row, setRow] = useState<ConnectorRow | null | undefined>(undefined);
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [webhook, setWebhook] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [testing, setTesting] = useState<'email' | 'slack' | null>(null);

  useEffect(() => {
    if (!supabase || !workspace) return;
    supabase
      .from('workspace_connectors')
      .select('resend_from_email, resend_reply_to, slack_webhook_url')
      .eq('workspace_id', workspace.id)
      .maybeSingle()
      .then(({ data }) => {
        const r = (data as ConnectorRow | null) ?? null;
        setRow(r);
        setFromEmail(r?.resend_from_email ?? '');
        setReplyTo(r?.resend_reply_to ?? '');
        setWebhook(r?.slack_webhook_url ?? '');
      });
  }, [workspace?.id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !workspace) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from('workspace_connectors').upsert(
      {
        workspace_id: workspace.id,
        resend_from_email: fromEmail.trim() || null,
        resend_reply_to: replyTo.trim() || null,
        slack_webhook_url: webhook.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    );
    setSaving(false);
    if (error) {
      setMsg({
        kind: 'err',
        text: error.message.includes('policy')
          ? 'Only the workspace owner can manage connectors.'
          : error.message,
      });
      return;
    }
    setMsg({ kind: 'ok', text: 'Saved.' });
  }

  async function sendTest(channel: 'email' | 'slack') {
    if (!supabase || !workspace) return;
    setTesting(channel);
    setMsg(null);
    const { data, error } = await supabase.functions.invoke('test-connector', {
      body: { workspace_id: workspace.id, channel },
    });
    setTesting(null);
    if (error || !data?.ok) {
      setMsg({ kind: 'err', text: error?.message ?? data?.error ?? 'Test failed' });
      return;
    }
    setMsg({
      kind: 'ok',
      text: channel === 'email' ? 'Test email sent — check your inbox.' : 'Test message posted to Slack.',
    });
  }

  if (!workspace) return null;
  if (row === undefined) return <div className="meta">Loading…</div>;

  return (
    <div className="card">
      <div className="card-pad stack gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="h2">Notifications & reports</span>
        <span className="meta">
          Where suggestion alerts and client reports get delivered. Owner-only.
        </span>
      </div>

      <form className="card-pad stack gap-12" onSubmit={save}>
        <div className="stack gap-4">
          <span style={{ fontWeight: 500, fontSize: 13 }}>Resend (email)</span>
          <span className="meta" style={{ fontSize: 11 }}>
            Requires a verified domain in your Resend account — emails to real clients won't
            deliver until the from-address domain is verified. The API key lives in the Edge
            Function secrets (RESEND_API_KEY), not here.
          </span>
        </div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <label className="stack gap-4" style={{ flex: 1, minWidth: 220 }}>
            <span className="meta">From address</span>
            <input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="reports@youragency.com"
              style={inputStyle}
              disabled={saving}
            />
          </label>
          <label className="stack gap-4" style={{ flex: 1, minWidth: 220 }}>
            <span className="meta">Reply-to (optional)</span>
            <input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="hello@youragency.com"
              style={inputStyle}
              disabled={saving}
            />
          </label>
        </div>

        <div className="stack gap-4" style={{ marginTop: 8 }}>
          <span style={{ fontWeight: 500, fontSize: 13 }}>Slack</span>
          <span className="meta" style={{ fontSize: 11 }}>
            An incoming-webhook URL (Slack → Apps → Incoming Webhooks). Treat it like a password —
            only the workspace owner can see or change it.
          </span>
        </div>
        <label className="stack gap-4">
          <span className="meta">Webhook URL</span>
          <input
            type="password"
            value={webhook}
            onChange={(e) => setWebhook(e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
            style={inputStyle}
            autoComplete="off"
            disabled={saving}
          />
        </label>

        {msg && (
          <div
            className="meta"
            style={{ color: msg.kind === 'err' ? 'var(--danger, #c33)' : undefined, fontSize: 11 }}
          >
            {msg.kind === 'err' ? '⚠ ' : '✓ '}
            {msg.text}
          </div>
        )}

        <div className="row gap-6">
          <button type="submit" className="btn primary sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save connectors'}
          </button>
          <button
            type="button"
            className="btn sm"
            disabled={testing !== null || !fromEmail.trim()}
            onClick={() => sendTest('email')}
          >
            {testing === 'email' ? 'Sending…' : 'Send test email'}
          </button>
          <button
            type="button"
            className="btn sm"
            disabled={testing !== null || !webhook.trim()}
            onClick={() => sendTest('slack')}
          >
            {testing === 'slack' ? 'Sending…' : 'Send test Slack message'}
          </button>
        </div>
      </form>
    </div>
  );
}
