import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';

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

  if (editing || !connection) {
    return (
      <ConnectionForm
        clientId={clientId}
        existing={connection ?? null}
        onSaved={() => {
          setEditing(false);
          refresh();
        }}
        onCancel={connection ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
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
  );
}

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
