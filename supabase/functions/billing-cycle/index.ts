// billing-cycle
//
// Postpaid invoicing for friends & family workspaces. Invoked by
// cron-dispatch daily (task 'billing_cycle', internal secret only):
//   * on the 1st of the month: invoice every ff account with any negative
//     balance;
//   * any other day: invoice accounts past the -$25 threshold.
// The invoice carries metadata.canopy = 'postpaid'; when Stripe collects
// it, stripe-webhook's invoice.paid handler posts the +amount ledger row
// that brings the balance back toward zero. Stripe owns email, dunning,
// and retries — we never mark anything paid ourselves.

// deno-lint-ignore-file no-explicit-any
import { json } from '../_shared/cors.ts';
import { isInternalCall } from '../_shared/internal.ts';
import { serviceClient } from '../_shared/auth.ts';
import { stripeConfigured, stripeRequest } from '../_shared/stripe.ts';

const THRESHOLD_USD = 25;

Deno.serve(async (req) => {
  if (!isInternalCall(req)) return json({ ok: false, error: 'Forbidden' }, 403);
  if (!stripeConfigured()) {
    console.log('[billing-cycle] Stripe not configured — nothing to do');
    return json({ ok: true, skipped: 'stripe not configured' });
  }

  const service = serviceClient();
  const firstOfMonth = new Date().getUTCDate() === 1;
  const cutoff = firstOfMonth ? 0 : -THRESHOLD_USD;

  const { data: accounts } = await service
    .from('billing_accounts')
    .select('workspace_id, stripe_customer_id, balance_usd')
    .eq('plan', 'friends_family')
    .lt('balance_usd', cutoff);

  let invoiced = 0;
  const errors: string[] = [];
  for (const acct of (accounts ?? []) as any[]) {
    const owed = -Number(acct.balance_usd);
    if (owed < 0.5) continue; // Stripe minimum charge
    if (!acct.stripe_customer_id) {
      errors.push(`${acct.workspace_id}: no stripe customer`);
      continue;
    }
    try {
      // Guard against double-billing: skip if we already have an open
      // postpaid invoice for this customer.
      const open = await stripeRequest('GET', '/invoices', {
        customer: acct.stripe_customer_id,
        status: 'open',
        limit: 10,
      });
      if ((open.data ?? []).some((inv: any) => inv.metadata?.canopy === 'postpaid')) continue;

      const invoice = await stripeRequest('POST', '/invoices', {
        customer: acct.stripe_customer_id,
        collection_method: 'send_invoice',
        days_until_due: 7,
        auto_advance: true,
        metadata: { canopy: 'postpaid', workspace_id: acct.workspace_id, app: 'canopystudio' },
      });
      await stripeRequest('POST', '/invoiceitems', {
        customer: acct.stripe_customer_id,
        invoice: invoice.id,
        amount: Math.round(owed * 100),
        currency: 'usd',
        description: 'CanopyStudio AI usage',
      });
      await stripeRequest('POST', `/invoices/${invoice.id}/finalize`, {});
      invoiced++;
    } catch (e) {
      errors.push(`${acct.workspace_id}: ${(e as Error).message}`);
    }
  }

  if (errors.length) console.error('[billing-cycle] errors:', errors.join(' | '));
  console.log(`[billing-cycle] invoiced ${invoiced} of ${(accounts ?? []).length} candidate account(s)`);
  return json({ ok: true, invoiced, candidates: (accounts ?? []).length, errors });
});
