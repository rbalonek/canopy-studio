import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useAuth } from '../../auth/AuthProvider';
import { invokeErrorText } from '../../lib/invokeError';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

/**
 * Settings → billing: the single billing surface. Plan + credit balance
 * (billing_accounts), this month's AI usage (ai_usage_events.billed_usd),
 * recent ledger activity, and the three money actions — Subscribe, Add
 * credits, Manage billing — all of which redirect through the
 * billing-portal Edge Function to Stripe-hosted pages. Payment truth only
 * ever arrives back via stripe-webhook; this panel never writes.
 */

interface Account {
  plan: string;
  plan_status: string;
  balance_usd: number;
  ff_expires_at: string | null;
  stripe_customer_id: string | null;
}

interface LedgerRow {
  id: string;
  delta_usd: number;
  kind: string;
  memo: string | null;
  created_at: string;
}

const PLAN_LABELS: Record<string, string> = {
  none: 'No plan',
  starter: 'Starter — $5/mo, $10 credits included',
  pro: 'Pro — $29/mo, $60 credits included',
  friends_family: 'Friends & family — usage billed monthly',
};

export function BillingPanel() {
  const workspace = useWorkspace();
  const auth = useAuth();
  const isOwner = !!workspace && workspace.ownerId === auth.user?.id;

  const [account, setAccount] = useState<Account | null>(null);
  const [monthBilled, setMonthBilled] = useState(0);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState('20');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) return;
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [acctRes, usageRes, ledgerRes] = await Promise.all([
        supabase
          .from('billing_accounts')
          .select('plan, plan_status, balance_usd, ff_expires_at, stripe_customer_id')
          .eq('workspace_id', workspace.id)
          .maybeSingle(),
        supabase
          .from('ai_usage_events')
          .select('billed_usd')
          .eq('workspace_id', workspace.id)
          .gte('created_at', monthStart.toISOString()),
        supabase
          .from('credit_ledger')
          .select('id, delta_usd, kind, memo, created_at')
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: false })
          .limit(25),
      ]);
      if (cancelled) return;
      setAccount((acctRes.data as unknown as Account) ?? null);
      setMonthBilled(
        (usageRes.data ?? []).reduce((sum, r) => sum + (Number(r.billed_usd) || 0), 0),
      );
      setLedger((ledgerRes.data ?? []) as unknown as LedgerRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  if (!workspace) {
    return (
      <div className="card card-pad">
        <span className="meta">Billing is available in the live app.</span>
      </div>
    );
  }

  async function portal(action: 'subscribe' | 'topup' | 'portal', plan?: string) {
    if (!supabase || !workspace) return;
    setBusy(action + (plan ?? ''));
    setMsg(null);
    const { data, error } = await supabase.functions.invoke('billing-portal', {
      body: {
        action,
        workspace_id: workspace.id,
        plan,
        amount_usd: action === 'topup' ? Number(topupAmount) : undefined,
        return_url: window.location.href,
      },
    });
    setBusy(null);
    if (error || !data?.ok || !data?.url) {
      setMsg(await invokeErrorText(data, error));
      return;
    }
    window.location.href = data.url as string;
  }

  const balance = Number(account?.balance_usd ?? 0);
  const plan = account?.plan ?? 'none';

  return (
    <div className="stack gap-16">
      <div className="card card-pad stack gap-10">
        <span className="h2">Plan &amp; credits</span>
        {loading ? (
          <span className="meta">Loading…</span>
        ) : (
          <>
            <div className="row gap-16" style={{ flexWrap: 'wrap' }}>
              <div className="stack gap-2">
                <span className="meta">Plan</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {PLAN_LABELS[plan] ?? plan}
                </span>
                {account?.plan_status && account.plan_status !== 'inactive' && (
                  <span className="tag">{account.plan_status}</span>
                )}
              </div>
              <div className="stack gap-2">
                <span className="meta">Credit balance</span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 20,
                    color: balance < 0 ? 'var(--danger, #c33)' : 'var(--accent)',
                  }}
                >
                  ${balance.toFixed(2)}
                </span>
                {plan === 'friends_family' && balance < 0 && (
                  <span className="meta" style={{ fontSize: 11 }}>
                    Accrued usage — invoiced monthly or at $25.
                  </span>
                )}
              </div>
              <div className="stack gap-2">
                <span className="meta">AI usage this month</span>
                <span style={{ fontWeight: 600, fontSize: 20 }}>${monthBilled.toFixed(2)}</span>
              </div>
            </div>
            {!account && (
              <span className="meta">
                Billing isn't enabled for this workspace yet — AI usage is tracked but nothing is
                charged or blocked. Subscribing turns billing on.
              </span>
            )}
          </>
        )}
        {isOwner ? (
          <div className="row gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            {plan !== 'pro' && (
              <button
                className="btn primary sm"
                disabled={!!busy}
                onClick={() => portal('subscribe', plan === 'starter' ? 'pro' : 'starter')}
              >
                {plan === 'starter' ? 'Upgrade to Pro' : 'Subscribe'}
              </button>
            )}
            <label className="row gap-4 meta" style={{ alignItems: 'center' }}>
              $
              <input
                type="number"
                min={5}
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                style={{
                  width: 70,
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--fg)',
                  padding: '5px 8px',
                  font: 'inherit',
                }}
              />
            </label>
            <button className="btn sm" disabled={!!busy} onClick={() => portal('topup')}>
              Add credits
            </button>
            {account?.stripe_customer_id && (
              <button className="btn ghost sm" disabled={!!busy} onClick={() => portal('portal')}>
                Manage billing (cards, invoices)
              </button>
            )}
          </div>
        ) : (
          <span className="meta" style={{ fontSize: 11 }}>
            Only the workspace owner can change billing.
          </span>
        )}
        {msg && (
          <span className="meta" style={{ color: 'var(--danger, #c33)' }}>
            ⚠ {msg}
          </span>
        )}
      </div>

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Recent activity</span>
        </div>
        {ledger.length === 0 ? (
          <div className="card-pad">
            <span className="meta">No billing activity yet.</span>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row) => (
                <tr key={row.id}>
                  <td className="meta">
                    {new Date(row.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="meta">{row.memo ?? row.kind.replace(/_/g, ' ')}</td>
                  <td
                    style={{
                      textAlign: 'right',
                      color: row.delta_usd < 0 ? undefined : 'var(--accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {row.delta_usd < 0 ? '−' : '+'}${Math.abs(Number(row.delta_usd)).toFixed(2)}
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
