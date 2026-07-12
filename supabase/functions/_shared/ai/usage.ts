// Token/cost accounting per LLM call → ai_usage_events + credit_ledger.
//
// Two prices per event:
//   cost_usd   — raw provider rate-card estimate (what the call cost US).
//   billed_usd — what we charge the workspace: the donor app's flat
//                floor/markup model (floor $0.13 generation-class / $0.10
//                analysis-class, ×2 markup, +$0.13 surcharge when the raw
//                cost tops $0.50). BYO-key calls (workspace_api_keys) pay
//                the provider directly, so we bill only a 10% platform fee
//                with no floor.
//
// Every event also debits credit_ledger (kind 'usage'); a trigger keeps
// billing_accounts.balance_usd in sync. Enforcement reads the balance in
// billingBlockReason() — accounting here must NEVER fail the job.

import type { ServiceClient } from '../auth.ts';
import type { LlmResult } from './providers.ts';

interface Rate {
  inputPer1k: number;
  outputPer1k: number;
}

// USD per 1k tokens. Prefix-matched so dated model IDs hit their family.
const RATES: Array<{ prefix: string; rate: Rate }> = [
  { prefix: 'claude-sonnet', rate: { inputPer1k: 0.003, outputPer1k: 0.015 } },
  { prefix: 'claude-haiku', rate: { inputPer1k: 0.001, outputPer1k: 0.005 } },
  { prefix: 'claude-opus', rate: { inputPer1k: 0.015, outputPer1k: 0.075 } },
  { prefix: 'gpt-4o-mini', rate: { inputPer1k: 0.00015, outputPer1k: 0.0006 } },
  { prefix: 'gpt-4o', rate: { inputPer1k: 0.0025, outputPer1k: 0.01 } },
  { prefix: 'gpt-4', rate: { inputPer1k: 0.01, outputPer1k: 0.03 } },
  { prefix: 'grok', rate: { inputPer1k: 0.003, outputPer1k: 0.015 } },
];

// Flat per-image raw-cost estimates (image APIs don't report tokens).
const IMAGE_COST_USD: Record<string, number> = {
  xai: 0.07,
  openai: 0.04,
};
const IMAGE_COST_FALLBACK_USD = 0.05;

// Billing constants (donor app's numbers; adjust here, never per-callsite).
const MARKUP = 2.0;
const GENERATION_FLOOR_USD = 0.13;
const ANALYSIS_FLOOR_USD = 0.1;
const SURCHARGE_USD = 0.13;
const SURCHARGE_THRESHOLD_USD = 0.5;
const BYO_FEE_RATE = 0.1;

// Analysis-class tasks get the lower floor; everything else (copy, creative
// directions, content plans, images…) is generation-class.
const ANALYSIS_TASKS = new Set([
  'website_analysis',
  'competitor_analysis',
  'account_analysis',
  'location_detection',
  'send_report',
  'test_prompt',
]);

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const match = RATES.find((r) => model.startsWith(r.prefix));
  if (!match) return 0;
  return (
    (inputTokens / 1000) * match.rate.inputPer1k +
    (outputTokens / 1000) * match.rate.outputPer1k
  );
}

export function billedUsd(
  task: string,
  rawCostUsd: number,
  keySource: 'workspace' | 'platform',
): number {
  if (keySource === 'workspace') {
    // Customer pays the provider themselves — platform fee only, no floor.
    return round4(rawCostUsd * BYO_FEE_RATE);
  }
  const floor = ANALYSIS_TASKS.has(task) ? ANALYSIS_FLOOR_USD : GENERATION_FLOOR_USD;
  let billed = Math.max(floor, rawCostUsd * MARKUP);
  if (rawCostUsd > SURCHARGE_THRESHOLD_USD) billed += SURCHARGE_USD;
  return round4(billed);
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

async function insertEventAndDebit(
  service: ServiceClient,
  row: {
    workspace_id: string;
    job_id: string | null;
    task: string;
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    billed_usd: number;
    key_source: string;
  },
): Promise<void> {
  const { data: event, error } = await service
    .from('ai_usage_events')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    console.error('[usage] failed to record usage event:', error.message);
    return;
  }
  if (row.billed_usd > 0) {
    const { error: ledgerErr } = await service.from('credit_ledger').insert({
      workspace_id: row.workspace_id,
      delta_usd: -row.billed_usd,
      kind: 'usage',
      usage_event_id: event?.id ?? null,
      memo: `${row.task} (${row.provider}/${row.model})`,
    });
    if (ledgerErr) console.error('[usage] failed to debit ledger:', ledgerErr.message);
  }
}

export async function recordUsage(
  service: ServiceClient,
  args: {
    workspaceId: string;
    jobId?: string | null;
    task: string;
    result: LlmResult;
  },
): Promise<void> {
  const { workspaceId, jobId, task, result } = args;
  const keySource = result.keySource ?? 'platform';
  const cost = estimateCostUsd(result.model, result.usage.input_tokens, result.usage.output_tokens);
  // Accounting must never fail the job — log and continue.
  await insertEventAndDebit(service, {
    workspace_id: workspaceId,
    job_id: jobId ?? null,
    task,
    provider: result.provider,
    model: result.model,
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
    cost_usd: cost,
    billed_usd: billedUsd(task, cost, keySource),
    key_source: keySource,
  });
}

/** Image generations have no token counts — flat per-image raw cost,
 * generation-class billing. Used by generate-post-image (which previously
 * recorded nothing — a billing leak). */
export async function recordImageUsage(
  service: ServiceClient,
  args: {
    workspaceId: string;
    provider: string;
    model: string;
    keySource: 'workspace' | 'platform';
  },
): Promise<void> {
  const cost = IMAGE_COST_USD[args.provider] ?? IMAGE_COST_FALLBACK_USD;
  await insertEventAndDebit(service, {
    workspace_id: args.workspaceId,
    job_id: null,
    task: 'image_generation',
    provider: args.provider,
    model: args.model,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: cost,
    billed_usd: billedUsd('image_generation', cost, args.keySource),
    key_source: args.keySource,
  });
}

/** Why AI work is blocked for this workspace, or null if allowed.
 * No billing_accounts row = billing not enabled = never blocked (existing
 * tenants keep working); enforcement starts when a plan/Stripe identity
 * exists. Blocks return HTTP 402 upstream — the UI unwraps the message
 * via error.context. */
export async function billingBlockReason(
  service: ServiceClient,
  workspaceId: string,
): Promise<string | null> {
  const { data } = await service
    .from('billing_accounts')
    .select('plan, plan_status, balance_usd, stripe_customer_id')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (!data) return null;
  const bal = Number(data.balance_usd) || 0;
  const plan = data.plan as string;

  if (plan === 'friends_family') {
    return bal <= -50
      ? 'This workspace hit its $50 usage limit — an invoice is on the way, and AI features resume once it is paid (Settings → billing).'
      : null;
  }
  if (plan === 'starter' || plan === 'pro') {
    if (data.plan_status !== 'active' && data.plan_status !== 'trialing') {
      return 'The subscription is not active — manage billing in Settings → billing.';
    }
    return bal <= 0
      ? 'All included credits are used — add credits or upgrade in Settings → billing.'
      : null;
  }
  // plan 'none': only enforce once the workspace has a Stripe identity
  // (i.e. billing was actually switched on and later lapsed).
  if (data.stripe_customer_id && bal <= 0) {
    return 'No active plan — subscribe or add credits in Settings → billing.';
  }
  return null;
}
