// Token/cost accounting per LLM call → ai_usage_events.
//
// Slimmed port of the donor's usage.js: same idea (per-model per-1k
// pricing, one row per call), minus its billing markup/Stripe logic —
// Canopy tracks cost, it doesn't resell it. Rates are estimates for
// display; unknown models record tokens with cost 0 rather than failing.

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
];

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const match = RATES.find((r) => model.startsWith(r.prefix));
  if (!match) return 0;
  return (
    (inputTokens / 1000) * match.rate.inputPer1k +
    (outputTokens / 1000) * match.rate.outputPer1k
  );
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
  const cost = estimateCostUsd(result.model, result.usage.input_tokens, result.usage.output_tokens);
  // Accounting must never fail the job — log and continue.
  const { error } = await service.from('ai_usage_events').insert({
    workspace_id: workspaceId,
    job_id: jobId ?? null,
    task,
    provider: result.provider,
    model: result.model,
    input_tokens: result.usage.input_tokens,
    output_tokens: result.usage.output_tokens,
    cost_usd: cost,
  });
  if (error) console.error('[usage] failed to record usage event:', error.message);
}
