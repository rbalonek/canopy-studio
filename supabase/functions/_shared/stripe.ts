// Minimal Stripe REST client + webhook signature verification.
//
// Raw fetch instead of the stripe npm SDK for the same reason providers.ts
// skips the AI SDKs: every call we need is a single form-encoded POST/GET,
// and the Deno bundle stays tiny. Secrets: STRIPE_SECRET_KEY (API),
// STRIPE_WEBHOOK_SECRET (signature), STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO
// / STRIPE_PRICE_FF (price ids created in the Stripe dashboard).

import type { ServiceClient } from './auth.ts';

const API = 'https://api.stripe.com/v1';

export function stripeConfigured(): boolean {
  return !!Deno.env.get('STRIPE_SECRET_KEY');
}

/** Form-encode params the way Stripe expects (bracket notation for nested
 * objects/arrays: line_items[0][price], metadata[workspace_id], …). */
// deno-lint-ignore no-explicit-any
export function stripeForm(params: Record<string, any>, prefix = ''): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (value: unknown, key: string) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${key}[${i}]`));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, key ? `${key}[${k}]` : k);
      }
    } else {
      out.append(key, String(value));
    }
  };
  walk(params, prefix);
  return out;
}

// deno-lint-ignore no-explicit-any
export async function stripeRequest<T = any>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  // deno-lint-ignore no-explicit-any
  params?: Record<string, any>,
): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  const body = params && method !== 'GET' ? stripeForm(params) : undefined;
  const qs = params && method === 'GET' ? `?${stripeForm(params)}` : '';
  const resp = await fetch(`${API}${path}${qs}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });
  // deno-lint-ignore no-explicit-any
  const data = (await resp.json()) as any;
  if (!resp.ok) {
    throw new Error(`Stripe ${method} ${path} failed (${resp.status}): ${data?.error?.message ?? 'unknown'}`);
  }
  return data as T;
}

/** Verify a Stripe-Signature header (t=…,v1=…) against the raw payload.
 * HMAC-SHA256 over `${t}.${payload}` with the webhook secret; constant-time
 * compare; 5-minute timestamp tolerance against replay. */
export async function verifyStripeSignature(
  payload: string,
  sigHeader: string | null,
): Promise<boolean> {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret || !sigHeader) return false;
  const parts = new Map(
    sigHeader.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1)] as [string, string];
    }),
  );
  const t = parts.get('t');
  const v1 = parts.get('v1');
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(`${t}.${payload}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export type Plan = 'none' | 'starter' | 'pro' | 'friends_family';

/** Which plan a Stripe price id represents (env-configured price ids). */
export function planForPrice(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get('STRIPE_PRICE_STARTER')) return 'starter';
  if (priceId === Deno.env.get('STRIPE_PRICE_PRO')) return 'pro';
  if (priceId === Deno.env.get('STRIPE_PRICE_FF')) return 'friends_family';
  return null;
}

/** Monthly credit allowance granted when a plan's subscription invoice is
 * paid. Friends & family has no monthly fee and no grant — it runs
 * postpaid. Amounts are the product decision "starter $5/mo → $10 of
 * credits"; change here when pricing changes. */
export function allowanceForPlan(plan: Plan): number {
  if (plan === 'starter') return 10;
  if (plan === 'pro') return 60;
  return 0;
}

/** Get or lazily create the workspace's Stripe customer. */
export async function ensureStripeCustomer(
  service: ServiceClient,
  workspaceId: string,
  email?: string | null,
): Promise<string> {
  const { data } = await service
    .from('billing_accounts')
    .select('stripe_customer_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  const existing = data?.stripe_customer_id as string | null | undefined;
  if (existing) return existing;

  const { data: ws } = await service
    .from('workspaces')
    .select('name, slug')
    .eq('id', workspaceId)
    .maybeSingle();
  const customer = await stripeRequest('POST', '/customers', {
    name: (ws?.name as string) ?? workspaceId,
    ...(email ? { email } : {}),
    metadata: { workspace_id: workspaceId, app: 'canopystudio' },
  });
  const { error } = await service.from('billing_accounts').upsert(
    { workspace_id: workspaceId, stripe_customer_id: customer.id, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id' },
  );
  if (error) throw new Error(`Could not store Stripe customer: ${error.message}`);
  return customer.id as string;
}
