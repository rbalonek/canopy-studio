// Live Reports: per-client report subscriptions (daily/weekly/monthly ×
// email/Slack) + sent history with preview. Sends run through the
// send_report job; the cron fires due subscriptions every morning.

import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { supabase } from '../../auth/supabaseClient';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { enqueueJob, useJob } from '../../data/useJob';

type SettingRow = {
  id: string;
  client_id: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  channel: 'email' | 'slack' | 'both';
  recipients: string[];
  enabled: boolean;
  last_sent_at: string | null;
  clients: { name: string } | null;
};

type SentRow = {
  id: string;
  client_id: string | null;
  cadence: string;
  period_start: string;
  period_end: string;
  subject: string;
  body_html: string | null;
  status: 'sent' | 'failed';
  error: string | null;
  sent_at: string;
};

export function LiveReports() {
  const workspace = useWorkspace();
  const [settings, setSettings] = useState<SettingRow[] | null>(null);
  const [sent, setSent] = useState<SentRow[] | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const job = useJob<{ sent?: boolean; error?: string; skipped?: boolean; reason?: string }>(jobId);

  async function refresh() {
    if (!supabase || !workspace) return;
    const [sRes, hRes, cRes] = await Promise.all([
      supabase
        .from('report_settings')
        .select('id, client_id, cadence, channel, recipients, enabled, last_sent_at, clients(name)')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('sent_reports')
        .select('id, client_id, cadence, period_start, period_end, subject, body_html, status, error, sent_at')
        .eq('workspace_id', workspace.id)
        .order('sent_at', { ascending: false })
        .limit(20),
      supabase.from('clients').select('id, name').eq('workspace_id', workspace.id).order('name'),
    ]);
    setSettings((sRes.data ?? []) as unknown as SettingRow[]);
    setSent((hRes.data ?? []) as unknown as SentRow[]);
    setClients((cRes.data ?? []) as Array<{ id: string; name: string }>);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  useEffect(() => {
    if (job.completed || job.failed) {
      setSendingId(null);
      setJobId(null);
      if (job.failed) setError(job.job?.error ?? 'Send failed');
      else if (job.job?.result?.skipped) setError(job.job.result.reason ?? 'Skipped — no data in period');
      else if (job.job?.result?.error) setError(job.job.result.error);
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.completed, job.failed]);

  async function toggle(row: SettingRow) {
    if (!supabase) return;
    await supabase.from('report_settings').update({ enabled: !row.enabled }).eq('id', row.id);
    refresh();
  }

  async function remove(row: SettingRow) {
    if (!supabase) return;
    if (!confirm(`Delete the ${row.cadence} report for ${row.clients?.name ?? row.client_id}?`)) return;
    await supabase.from('report_settings').delete().eq('id', row.id);
    refresh();
  }

  async function sendNow(row: SettingRow) {
    if (!workspace) return;
    setError(null);
    setSendingId(row.id);
    try {
      const id = await enqueueJob({
        type: 'send_report',
        workspaceId: workspace.id,
        clientId: row.client_id,
        input: { report_settings_id: row.id },
      });
      setJobId(id);
    } catch (e) {
      setSendingId(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!workspace) return null;
  if (settings === null || sent === null) {
    return (
      <div className="content wide">
        <span className="meta">Loading…</span>
      </div>
    );
  }

  const preview = sent.find((s) => s.id === previewId) ?? null;

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4">
          <h1 className="h0">Reports</h1>
          <span className="meta">
            Client-ready performance digests — AI narrative + numbers, delivered on a schedule.
          </span>
        </div>
        {!adding && (
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={13} /> New report schedule
          </button>
        )}
      </div>

      {adding && (
        <AddScheduleForm
          workspaceId={workspace.id}
          clients={clients}
          onDone={() => {
            setAdding(false);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {error && (
        <div className="card card-pad meta" style={{ color: 'var(--danger, #c33)', marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Schedules</span>
        </div>
        {settings.length === 0 && (
          <div className="card-pad meta">
            No report schedules yet. Reports send at 07:00 UTC — daily every day, weekly on
            Mondays, monthly on the 1st.
          </div>
        )}
        {settings.map((row, i) => (
          <div
            key={row.id}
            className="card-pad row between"
            style={{
              gap: 12,
              borderBottom: i < settings.length - 1 ? '1px solid var(--border)' : 0,
              opacity: row.enabled ? 1 : 0.55,
            }}
          >
            <div className="stack gap-2">
              <div className="row gap-8">
                <span style={{ fontWeight: 500 }}>{row.clients?.name ?? row.client_id}</span>
                <span className="pill teal" style={{ fontSize: 10 }}>
                  {row.cadence}
                </span>
                <span className="pill gray" style={{ fontSize: 10 }}>
                  {row.channel}
                </span>
              </div>
              <span className="meta" style={{ fontSize: 11 }}>
                {row.recipients.length ? row.recipients.join(', ') : 'No email recipients'}
                {row.last_sent_at
                  ? ` · last sent ${new Date(row.last_sent_at).toLocaleDateString()}`
                  : ' · never sent'}
              </span>
            </div>
            <div className="row gap-6">
              <button
                className="btn sm"
                onClick={() => sendNow(row)}
                disabled={sendingId !== null}
              >
                {sendingId === row.id
                  ? `Sending… ${job.job?.progress ?? 0}%`
                  : 'Send now'}
              </button>
              <button className="btn ghost sm" onClick={() => toggle(row)}>
                {row.enabled ? 'Pause' : 'Resume'}
              </button>
              <button className="btn ghost sm" onClick={() => remove(row)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Sent history</span>
        </div>
        {sent.length === 0 && <div className="card-pad meta">Nothing sent yet.</div>}
        {sent.map((s, i) => (
          <div
            key={s.id}
            className="card-pad stack gap-6"
            style={{ borderBottom: i < sent.length - 1 ? '1px solid var(--border)' : 0 }}
          >
            <div className="row between" style={{ gap: 12 }}>
              <div className="stack gap-2">
                <span style={{ fontWeight: 500, fontSize: 13 }}>{s.subject}</span>
                <span className="meta" style={{ fontSize: 11 }}>
                  {new Date(s.sent_at).toLocaleString()} ·{' '}
                  <span style={{ color: s.status === 'failed' ? 'var(--danger, #c33)' : undefined }}>
                    {s.status}
                  </span>
                  {s.error ? ` — ${s.error}` : ''}
                </span>
              </div>
              {s.body_html && (
                <button
                  className="btn sm"
                  onClick={() => setPreviewId(previewId === s.id ? null : s.id)}
                >
                  {previewId === s.id ? 'Hide' : 'Preview'}
                </button>
              )}
            </div>
            {preview?.id === s.id && preview.body_html && (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  padding: 16,
                  maxHeight: 480,
                  overflow: 'auto',
                }}
                // Our own server-rendered report HTML (escaped at render
                // time in the Edge Function).
                dangerouslySetInnerHTML={{ __html: preview.body_html }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AddScheduleForm({
  workspaceId,
  clients,
  onDone,
  onCancel,
}: {
  workspaceId: string;
  clients: Array<{ id: string; name: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [channel, setChannel] = useState<'email' | 'slack' | 'both'>('email');
  const [recipients, setRecipients] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!supabase || !clientId) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from('report_settings').insert({
      workspace_id: workspaceId,
      client_id: clientId,
      cadence,
      channel,
      recipients: recipients
        .split(/[,;\s]+/)
        .map((r) => r.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (err) {
      setError(
        err.message.includes('duplicate')
          ? 'That client already has a report at this cadence.'
          : err.message,
      );
      return;
    }
    onDone();
  }

  return (
    <div className="card card-pad stack gap-12" style={{ marginBottom: 16 }}>
      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <label className="stack gap-4" style={{ minWidth: 180 }}>
          <span className="meta">Client</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={formInput}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="stack gap-4">
          <span className="meta">Cadence</span>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as typeof cadence)}
            style={formInput}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly (Mondays)</option>
            <option value="monthly">Monthly (1st)</option>
          </select>
        </label>
        <label className="stack gap-4">
          <span className="meta">Channel</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as typeof channel)}
            style={formInput}
          >
            <option value="email">Email</option>
            <option value="slack">Slack</option>
            <option value="both">Email + Slack</option>
          </select>
        </label>
        <label className="stack gap-4" style={{ flex: 1, minWidth: 240 }}>
          <span className="meta">Email recipients (comma-separated)</span>
          <input
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            placeholder="client@company.com, owner@company.com"
            style={formInput}
          />
        </label>
      </div>
      {error && (
        <span className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
          ⚠ {error}
        </span>
      )}
      <div className="row gap-6">
        <button className="btn primary sm" onClick={save} disabled={saving || !clientId}>
          {saving ? 'Saving…' : 'Create schedule'}
        </button>
        <button className="btn ghost sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const formInput: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  padding: '10px 12px',
  font: 'inherit',
  fontSize: 13,
  outline: 'none',
};
