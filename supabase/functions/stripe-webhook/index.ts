// stripe-webhook
//
// The ONLY writer of payment truth. Stripe POSTs events here; the gate is
// the Stripe-Signature HMAC (verify_jwt = false in config.toml — Stripe
// sends no JWT; exactly the cron-dispatch precedent of "public endpoint,
// real gate in code"). Every event id is recorded in stripe_events first —
// Stripe retries deliveries, so processing must be idempotent.
//
// Handled events:
//   checkout.session.completed          → top-up credits (+amount)
//   invoice.paid                        → subscription allowance grant, or
//                                         postpaid (friends & family)
//                                         balance clear
//   customer.subscription.created/
//     updated/deleted                   → sync plan + plan_status
//
// This webhook-driven design replaces the donor app's client-triggered
// verify-payment call, which silently lost payments when the user closed
// the tab before the redirect landed.

// deno-lint-ignore-file no-explicit-any
import { serviceClient } from '../_shared/auth.ts';
import { allowanceForPlan, planForPrice, verifyStripeSignature } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const payload = await req.text();
  const ok = await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'));
  if (!ok) return new Response('Invalid signature', { status: 400 });

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const service = serviceClient();

  // Idempotency: first delivery inserts the id; retries find it and no-op.
  const { data: fresh, error: dupErr } = await service
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })
    .select('id')
    .maybeSingle();
  if (dupErr && !dupErr.message.includes('duplicate')) {
    console.error('[stripe-webhook] event insert failed:', dupErr.message);
    return new Response('Storage error', { status: 500 });
  }
  if (!fresh) return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await onCheckoutCompleted(service, event.data.object);
        break;
      case 'invoice.paid':
        await onInvoicePaid(service, event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await onSubscriptionChange(service, event.data.object, event.type.endsWith('deleted'));
        break;
      default:
        // Signed + recorded, just not interesting.
        break;
    }
  } catch (e) {
    // Let Stripe retry: remove the idempotency row so the retry processes.
    console.error(`[stripe-webhook] ${event.type} failed:`, (e as Error).message);
    await service.from('stripe_events').delete().eq('id', event.id);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});

async function workspaceForCustomer(service: any, customerId: string): Promise<string | null> {
  const { data } = await service
    .from('billing_accounts')
    .select('workspace_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

/** Top-ups: Checkout sessions in mode 'payment' carrying our metadata.
 * Subscription checkouts also fire this event but their money arrives via
 * invoice.paid — skip them here. */
async function onCheckoutCompleted(service: any, session: any): Promise<void> {
  if (session.mode !== 'payment') return;
  if (session.metadata?.payment_type !== 'topup') return;
  if (session.payment_status !== 'paid') return;
  const workspaceId =
    session.metadata?.workspace_id ?? (await workspaceForCustomer(service, session.customer));
  if (!workspaceId) {
    throw new Error(`top-up session ${session.id} has no resolvable workspace`);
  }
  const amount = (session.amount_total ?? 0) / 100;
  if (amount <= 0) return;
  const { error } = await service.from('credit_ledger').insert({
    workspace_id: workspaceId,
    delta_usd: amount,
    kind: 'topup',
    stripe_ref: session.id,
    memo: 'Credit top-up',
  });
  if (error) throw new Error(error.message);
}

async function onInvoicePaid(service: any, invoice: any): Promise<void> {
  const workspaceId =
    invoice.metadata?.workspace_id ?? (await workspaceForCustomer(service, invoice.customer));
  if (!workspaceId) {
    console.error(`[stripe-webhook] invoice ${invoice.id} has no resolvable workspace — ignoring`);
    return;
  }

  // Postpaid friends & family invoice (created by billing-cycle with this
  // marker): the payment clears the accrued negative balance.
  if (invoice.metadata?.canopy === 'postpaid') {
    const amount = (invoice.amount_paid ?? 0) / 100;
    if (amount <= 0) return;
    const { error } = await service.from('credit_ledger').insert({
      workspace_id: workspaceId,
      delta_usd: amount,
      kind: 'postpaid_invoice',
      stripe_ref: invoice.id,
      memo: 'Usage invoice paid',
    });
    if (error) throw new Error(error.message);
    return;
  }

  // Subscription invoice: grant the plan's monthly allowance. Allowances
  // roll over while the subscription stays active (one append-only ledger).
  const priceId = invoice.lines?.data?.[0]?.price?.id ?? invoice.lines?.data?.[0]?.pricing?.price_details?.price;
  const plan = planForPrice(priceId);
  if (!plan) return; // not one of our plans (or a $0 FF invoice)
  const allowance = allowanceForPlan(plan);
  if (allowance <= 0) return;
  const { error } = await service.from('credit_ledger').insert({
    workspace_id: workspaceId,
    delta_usd: allowance,
    kind: 'subscription_grant',
    stripe_ref: invoice.id,
    memo: `${plan} monthly credits`,
  });
  if (error) throw new Error(error.message);
}

async function onSubscriptionChange(service: any, sub: any, deleted: boolean): Promise<void> {
  const workspaceId =
    sub.metadata?.workspace_id ?? (await workspaceForCustomer(service, sub.customer));
  if (!workspaceId) {
    console.error(`[stripe-webhook] subscription ${sub.id} has no resolvable workspace — ignoring`);
    return;
  }
  const priceId = sub.items?.data?.[0]?.price?.id;
  const plan = deleted ? 'none' : (planForPrice(priceId) ?? 'none');
  const { error } = await service.from('billing_accounts').upsert(
    {
      workspace_id: workspaceId,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: deleted ? null : sub.id,
      plan,
      plan_status: deleted ? 'canceled' : (sub.status ?? 'inactive'),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id' },
  );
  if (error) throw new Error(error.message);
}
