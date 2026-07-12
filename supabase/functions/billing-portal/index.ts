// billing-portal
//
// Authed, owner-gated entry for everything money-related the browser needs:
//   action 'subscribe' → Stripe Checkout session (mode subscription) for a
//                        plan; friends_family uses the $0 price so upgrade
//                        later is a one-click price swap.
//   action 'topup'     → Checkout session (mode payment) adding credits.
//   action 'portal'    → Stripe Billing Portal session (cards, invoices,
//                        cancel).
// Returns { url } to redirect to. State changes all arrive later via
// stripe-webhook — this function never writes the ledger.

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import { authenticate, serviceClient } from '../_shared/auth.ts';
import { ensureStripeCustomer, stripeConfigured, stripeRequest } from '../_shared/stripe.ts';

interface PortalRequest {
  action: 'subscribe' | 'topup' | 'portal';
  workspace_id: string;
  plan?: 'starter' | 'pro' | 'friends_family';
  amount_usd?: number;
  return_url?: string;
}

const PLAN_PRICE_ENV: Record<string, string> = {
  starter: 'STRIPE_PRICE_STARTER',
  pro: 'STRIPE_PRICE_PRO',
  friends_family: 'STRIPE_PRICE_FF',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as PortalRequest;
    if (!body?.action || !body?.workspace_id) {
      return json({ ok: false, error: 'action and workspace_id are required' }, 400);
    }
    if (!stripeConfigured()) {
      return json({ ok: false, error: 'Billing is not configured yet (Stripe keys pending).' }, 400);
    }

    const caller = await authenticate(req);
    if (!caller) return json({ ok: false, error: 'Invalid session' }, 401);

    // Owner-only: billing changes are the owner's call, same stance as
    // credential tables.
    const service = serviceClient();
    const { data: ws } = await service
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', body.workspace_id)
      .maybeSingle();
    if (!ws) return json({ ok: false, error: 'Workspace not found' }, 404);
    if (ws.owner_id !== caller.userId) {
      return json({ ok: false, error: 'Only the workspace owner can manage billing.' }, 403);
    }

    const returnUrl = body.return_url ?? 'https://canopystudio.app';
    const { data: ownerUser } = await service.auth.admin.getUserById(caller.userId);
    const customerId = await ensureStripeCustomer(
      service,
      body.workspace_id,
      ownerUser?.user?.email ?? null,
    );

    if (body.action === 'portal') {
      const session = await stripeRequest('POST', '/billing_portal/sessions', {
        customer: customerId,
        return_url: returnUrl,
      });
      return json({ ok: true, url: session.url });
    }

    if (body.action === 'subscribe') {
      const plan = body.plan ?? 'starter';
      const price = Deno.env.get(PLAN_PRICE_ENV[plan] ?? '');
      if (!price) {
        return json({ ok: false, error: `No Stripe price configured for plan "${plan}".` }, 400);
      }
      const session = await stripeRequest('POST', '/checkout/sessions', {
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price, quantity: 1 }],
        subscription_data: { metadata: { workspace_id: body.workspace_id } },
        metadata: { workspace_id: body.workspace_id, app: 'canopystudio' },
        success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}billing=subscribed`,
        cancel_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}billing=canceled`,
      });
      return json({ ok: true, url: session.url });
    }

    // topup
    const amount = Math.round((body.amount_usd ?? 0) * 100);
    if (!Number.isFinite(amount) || amount < 500) {
      return json({ ok: false, error: 'Top-ups start at $5.' }, 400);
    }
    const session = await stripeRequest('POST', '/checkout/sessions', {
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            product_data: { name: 'CanopyStudio credits' },
          },
        },
      ],
      metadata: {
        workspace_id: body.workspace_id,
        payment_type: 'topup',
        app: 'canopystudio',
      },
      success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}billing=topup_done`,
      cancel_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}billing=canceled`,
    });
    return json({ ok: true, url: session.url });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
