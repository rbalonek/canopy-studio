import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { CampaignsTable } from '../campaigns/CampaignsTable';

/**
 * Reads + writes a single meta_accounts row per client. Holds the
 * manual-token credentials the user pastes while OAuth is pending Meta
 * review. The access_token itself is never read back to the browser —
 * after save we only know it exists ({@link hasAccessToken}), not its
 * value. A future Edge Function reads it via the service_role key to
 * actually call the Graph API.
 */
type MetaConnection = {
  accountId: string | null;
  pageId: string | null;
  instagramBusinessAccountId: string | null;
  hasAccessToken: boolean;
  updatedAt: string | null;
};

export function AdAccountsTab({ clientId }: { clientId: string }) {
  const [connection, setConnection] = useState<MetaConnection | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setConnection(null);
      return;
    }
    // Note: never select access_token here. We only need to know whether
    // one is stored (via a separate cheap check).
    const { data, error } = await supabase
      .from('meta_accounts')
      .select(
        'account_id, page_id, instagram_business_account_id, access_token, updated_at',
      )
      .eq('client_id', clientId)
      .maybeSingle();
    if (error || !data) {
      setConnection(null);
      return;
    }
    setConnection({
      accountId: data.account_id ?? null,
      pageId: data.page_id ?? null,
      instagramBusinessAccountId: data.instagram_business_account_id ?? null,
      hasAccessToken: !!data.access_token,
      updatedAt: data.updated_at ?? null,
    });
  }, [clientId]);

  useEffect(() => {
    setConnection(undefined);
    refresh();
  }, [refresh]);

  if (connection === undefined) {
    return <div className="meta">Loading…</div>;
  }

  return (
    <div className="stack gap-16">
      {editing || !connection ? (
        <ConnectionForm
          clientId={clientId}
          existing={connection ?? null}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
          onCancel={connection ? () => setEditing(false) : undefined}
        />
      ) : (
        <ConnectionCard
          connection={connection}
          onEdit={() => setEditing(true)}
          onDisconnect={async () => {
            if (!supabase) return;
            if (!confirm('Disconnect Meta from this client? Stored token will be removed.')) return;
            await supabase.from('meta_accounts').delete().eq('client_id', clientId);
            refresh();
          }}
        />
      )}
      {connection && !editing && <PullPastData clientId={clientId} />}
      <MetaAppOverridePanel clientId={clientId} />
      <CampaignsTable clientId={clientId} />
    </div>
  );
}

type AppOverride = {
  hasToken: boolean;
  appId: string | null;
  label: string | null;
  updatedAt: string | null;
};

/**
 * Per-client Meta app override. By default every client runs on the
 * workspace master token (Settings → Connections); a client testing under
 * a different Meta app (its own token, e.g. a dedicated posting app) gets
 * that token stored here — the Edge Functions prefer it over the
 * workspace token. Owner-only writes (RLS); token is write-only in the UI.
 */
function MetaAppOverridePanel({ clientId }: { clientId: string }) {
  const [override, setOverride] = useState<AppOverride | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState('');
  const [appId, setAppId] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setOverride(null);
      return;
    }
    const { data } = await supabase
      .from('client_meta_credentials')
      .select('access_token, app_id, label, updated_at')
      .eq('client_id', clientId)
      .maybeSingle();
    if (!data) {
      setOverride(null);
      return;
    }
    setOverride({
      hasToken: !!data.access_token,
      appId: (data.app_id as string | null) ?? null,
      label: (data.label as string | null) ?? null,
      updatedAt: (data.updated_at as string | null) ?? null,
    });
  }, [clientId]);

  useEffect(() => {
    setOverride(undefined);
    setEditing(false);
    refresh();
  }, [refresh]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!token.trim()) {
      setErr('Paste the access token for this app.');
      return;
    }
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from('client_meta_credentials').upsert(
      {
        client_id: clientId,
        access_token: token.trim(),
        app_id: appId.trim() || null,
        label: label.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id' },
    );
    setSaving(false);
    if (error) {
      // Most likely cause for a member: owner-only RLS.
      setErr(
        error.message.includes('row-level security')
          ? 'Only the workspace owner can set a client token override.'
          : error.message,
      );
      return;
    }
    setToken('');
    setEditing(false);
    refresh();
  }

  async function onRemove() {
    if (!supabase) return;
    if (
      !confirm(
        'Remove this client’s app override? It will go back to using the workspace master token.',
      )
    )
      return;
    const { error } = await supabase
      .from('client_meta_credentials')
      .delete()
      .eq('client_id', clientId);
    if (error) setErr(error.message);
    refresh();
  }

  if (override === undefined) return null;

  const showForm = editing || (!override && editing);

  return (
    <div className="card">
      <div className="card-pad row between" style={{ borderBottom: showForm || override ? '1px solid var(--border)' : 0 }}>
        <div className="stack gap-2">
          <span style={{ fontWeight: 500 }}>Meta app override</span>
          <span className="meta">
            {override?.hasToken ? (
              <>
                This client uses its own app token
                {override.label || override.appId ? (
                  <>
                    {' '}
                    — <strong>{override.label ?? 'unnamed app'}</strong>
                    {override.appId ? ` (${override.appId})` : ''}
                  </>
                ) : null}
                . Refresh + publishing use it instead of the workspace token.
              </>
            ) : (
              <>Using the workspace master token (default). Add an override to run this client under a different Meta app.</>
            )}
          </span>
        </div>
        <div className="row gap-8">
          {override?.hasToken && !editing && (
            <button className="btn ghost sm" onClick={onRemove}>
              Remove
            </button>
          )}
          {!editing && (
            <button
              className="btn sm"
              onClick={() => {
                setLabel(override?.label ?? '');
                setAppId(override?.appId ?? '');
                setToken('');
                setErr(null);
                setEditing(true);
              }}
            >
              <Icon name="link" size={12} /> {override?.hasToken ? 'Update' : 'Add override'}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <form onSubmit={onSave} className="card-pad stack gap-10">
          <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
            <label className="stack gap-4" style={{ flex: 1, minWidth: 180 }}>
              <span className="meta">App name (for your reference)</span>
              <input
                type="text"
                className="input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="RDS - Posting App"
                disabled={saving}
              />
            </label>
            <label className="stack gap-4" style={{ flex: 1, minWidth: 180 }}>
              <span className="meta">App ID (optional)</span>
              <input
                type="text"
                className="input"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="1830348180972716"
                disabled={saving}
              />
            </label>
          </div>
          <label className="stack gap-4">
            <span className="meta">Access token (write-only — never shown again)</span>
            <input
              type="password"
              className="input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EAAB…"
              autoComplete="off"
              disabled={saving}
            />
          </label>
          {err && (
            <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 12 }}>
              ⚠ {err}
            </div>
          )}
          <div className="row gap-8">
            <button type="submit" className="btn primary sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save override'}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!editing && override?.hasToken && (
        <div className="card-pad meta" style={{ fontSize: 11 }}>
          Token stored (••••••••) · last updated{' '}
          {override.updatedAt
            ? new Date(override.updatedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : '—'}
        </div>
      )}
    </div>
  );
}

/**
 * Backfill historical daily metrics for a date range without a full account
 * refresh. Invokes meta-refresh-client with a `backfill` window; the function
 * pulls per-day campaign insights (time_range + time_increment=1) and upserts
 * them into campaign_metrics_daily (idempotent), so a user can pull, say, this
 * year and last year for comparison in the Overview tab's Custom range. The
 * current campaigns snapshot is untouched.
 */
function PullPastData({ clientId }: { clientId: string }) {
  const [range, setRange] = useState(() => lastYearRange());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function pull() {
    if (!supabase) return;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('meta-refresh-client', {
        body: { client_id: clientId, backfill: { since: range.start, until: range.end } },
      });
      if (error) {
        setResult({ ok: false, msg: error.message });
      } else {
        const days = (data as any)?.refreshed ?? 0;
        const skipped = (data as any)?.skipped as number | undefined;
        const errs = (data as any)?.errors as string[] | undefined;
        const singular = (data as any)?.error as string | undefined;
        const skipNote = skipped ? ` (${skipped} skipped — deleted campaigns)` : '';
        if (singular) {
          // Setup error (no token / no ad account / bad range).
          setResult({ ok: false, msg: singular });
        } else if (errs?.length) {
          // Partial or full per-chunk failure — surface the actual messages.
          setResult({
            ok: days > 0,
            msg: `Pulled ${days} day-rows${skipNote}; ${errs.length} error(s): ${errs.slice(0, 3).join(' | ')}`,
          });
        } else {
          setResult({
            ok: true,
            msg: `Pulled ${days} day-rows of history${skipNote}. View it under Overview → Custom.`,
          });
        }
      }
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <div className="card card-pad stack gap-10">
      <div className="row gap-8">
        <Icon name="calendar" size={14} />
        <span style={{ fontWeight: 500 }}>Pull past data</span>
      </div>
      <div className="meta" style={{ fontSize: 12 }}>
        Backfill historical daily performance from Meta for a specific date range — e.g. this year or
        last year — so you can compare periods in <strong>Overview → Custom</strong> without a full
        account refresh. Safe to re-run; existing days are overwritten, not duplicated.
      </div>
      <div className="row gap-8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="date"
          value={range.start}
          max={range.end}
          onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
          style={dateInputStyle}
          disabled={busy}
        />
        <span className="meta">→</span>
        <input
          type="date"
          value={range.end}
          min={range.start}
          max={todayISO()}
          onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
          style={dateInputStyle}
          disabled={busy}
        />
        <div className="seg">
          <button style={presetBtnStyle} onClick={() => setRange(thisYearRange())} disabled={busy}>
            This year
          </button>
          <button style={presetBtnStyle} onClick={() => setRange(lastYearRange())} disabled={busy}>
            Last year
          </button>
        </div>
        <button className="btn primary sm" onClick={pull} disabled={busy}>
          {busy ? 'Pulling…' : 'Pull past data'}
        </button>
      </div>
      {result && (
        <div
          className="banner"
          style={{ color: result.ok ? 'var(--fg)' : 'var(--danger, #c33)', fontSize: 12 }}
        >
          {result.ok ? '✓ ' : '⚠ '}
          {result.msg}
        </div>
      )}
    </div>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function thisYearRange(): { start: string; end: string } {
  const y = new Date().getFullYear();
  return { start: `${y}-01-01`, end: todayISO() };
}
function lastYearRange(): { start: string; end: string } {
  const y = new Date().getFullYear() - 1;
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

const dateInputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  padding: '6px 10px',
  font: 'inherit',
  fontSize: 12,
};
const presetBtnStyle: React.CSSProperties = { padding: '4px 12px', fontSize: 12 };

function ConnectionCard({
  connection,
  onEdit,
  onDisconnect,
}: {
  connection: MetaConnection;
  onEdit: () => void;
  onDisconnect: () => void;
}) {
  const updated = connection.updatedAt
    ? new Date(connection.updatedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';
  return (
    <div className="stack gap-12">
      <div className="card card-pad stack gap-10">
        <div className="row between">
          <div className="row gap-8">
            <Icon name="link" size={14} />
            <span style={{ fontWeight: 500 }}>Meta connection</span>
            <span className="pill green">
              <span className="dot" />
              Connected
            </span>
          </div>
          <div className="row gap-8">
            <button className="btn ghost sm" onClick={onEdit}>
              Update credentials
            </button>
            <button className="btn ghost sm" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
        <div className="grid grid-2 gap-12" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Ad account ID" value={connection.accountId} mono />
          <Field label="Page ID" value={connection.pageId} mono />
          <Field label="Instagram Business ID" value={connection.instagramBusinessAccountId} mono />
          <Field
            label="Access token"
            value={connection.hasAccessToken ? '••••••••  (stored)' : 'Not set'}
          />
        </div>
        <div className="meta" style={{ fontSize: 11 }}>
          Last updated {updated}. The token is stored and used server-side to call the Meta Graph
          API — we don't display it back to the browser for security. To replace it, click Update
          credentials.
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="stack gap-2">
      <span className="meta">{label}</span>
      <span
        className={mono ? 'mono' : ''}
        style={{ fontSize: 13, color: value ? 'var(--fg)' : 'var(--fg-3)' }}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function ConnectionForm({
  clientId,
  existing,
  onSaved,
  onCancel,
}: {
  clientId: string;
  existing: MetaConnection | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [accessToken, setAccessToken] = useState('');
  const [pageId, setPageId] = useState(existing?.pageId ?? '');
  const [igAccountId, setIgAccountId] = useState(existing?.instagramBusinessAccountId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    setSubmitting(true);
    setError(null);

    // Build the upsert payload. Only include access_token when the user
    // typed one — leaving the field blank means "keep the existing token."
    const payload: Record<string, unknown> = {
      client_id: clientId,
      account_id: accountId.trim() || null,
      page_id: pageId.trim() || null,
      instagram_business_account_id: igAccountId.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (accessToken.trim()) payload.access_token = accessToken.trim();

    const { error: dbErr } = await supabase
      .from('meta_accounts')
      .upsert(payload, { onConflict: 'client_id' });

    if (dbErr) {
      setError(dbErr.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSaved();
  }

  return (
    <form className="card card-pad-lg stack gap-16" onSubmit={onSubmit} style={{ padding: 28 }}>
      <div className="stack gap-4">
        <h2 className="h2">{existing ? 'Update Meta credentials' : 'Connect a Meta account'}</h2>
        <div className="meta">
          Paste the long-lived access token + IDs from your Meta Business / Graph API Explorer.
          We'll use these to pull campaign performance and post via the Marketing + Pages APIs.
          OAuth will replace this form once the Meta app review is approved.
        </div>
      </div>

      <label className="stack gap-4">
        <span className="meta">Ad Account ID</span>
        <input
          type="text"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          placeholder="act_139204882"
          style={inputStyle}
          disabled={submitting}
        />
        <span className="meta" style={{ fontSize: 11 }}>
          Find it in Business Manager → Ad Accounts (the numeric ID prefixed with{' '}
          <code>act_</code>).
        </span>
      </label>

      <label className="stack gap-4">
        <span className="meta">Access token {existing?.hasAccessToken && '(leave blank to keep existing)'}</span>
        <input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={existing?.hasAccessToken ? '•••••••••' : 'EAAB...'}
          style={inputStyle}
          autoComplete="off"
          disabled={submitting}
        />
        <span className="meta" style={{ fontSize: 11 }}>
          Long-lived user token or system user token. Generate via Graph API Explorer → Get
          Token → extend at developers.facebook.com/tools/debug/accesstoken.
        </span>
      </label>

      <div className="grid grid-2 gap-12" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <label className="stack gap-4">
          <span className="meta">Facebook Page ID (optional)</span>
          <input
            type="text"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            placeholder="1234567890"
            style={inputStyle}
            disabled={submitting}
          />
        </label>
        <label className="stack gap-4">
          <span className="meta">Instagram Business ID (optional)</span>
          <input
            type="text"
            value={igAccountId}
            onChange={(e) => setIgAccountId(e.target.value)}
            placeholder="17841400000000000"
            style={inputStyle}
            disabled={submitting}
          />
        </label>
      </div>

      {error && (
        <div className="banner" style={{ color: 'var(--danger, #c33)', justifyContent: 'center' }}>
          ⚠ {error}
        </div>
      )}

      <div className="row between">
        {onCancel ? (
          <button type="button" className="btn ghost" onClick={onCancel} disabled={submitting}>
            ← Cancel
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? 'Saving…' : existing ? 'Save changes' : 'Save connection'}
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  padding: '10px 12px',
  font: 'inherit',
};
