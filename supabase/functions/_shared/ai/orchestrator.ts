// Orchestrator: turns an (workspace, task) pair into concrete LLM calls.
//
// Reads ai_settings to decide mode:
//   - 'anthropic' / 'openai'  → one call by the primary provider (1 step)
//   - 'collaboration'         → generate → review → refine (3 steps),
//     the donor app's AI+AI flow generalized: primary generates, reviewer
//     critiques, primary refines with the critique.
//
// Steps are EXECUTED ONE PER EDGE-FUNCTION INVOCATION by run-job — this
// module only knows how to run "the step numbered N given prior state".
// Intermediate state (draft, review) rides along in jobs.state.

import type { ServiceClient } from '../auth.ts';
import { invokeInternal } from '../internal.ts';
import {
  callLlm,
  extractJson,
  type LlmOptions,
  type Provider,
} from './providers.ts';
import {
  REFINEMENT_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  type ProfileDoc,
  type Skill,
} from './prompts.ts';
import { recordUsage } from './usage.ts';

export type AiMode = 'anthropic' | 'openai' | 'collaboration';

export interface AiTaskSettings {
  mode: AiMode;
  primaryProvider: Provider;
  primaryModel: string | null;
  reviewerProvider: Provider;
  reviewerModel: string | null;
  options: Record<string, unknown>;
}

const DEFAULT_SETTINGS: AiTaskSettings = {
  mode: 'anthropic',
  primaryProvider: 'anthropic',
  primaryModel: null,
  reviewerProvider: 'openai',
  reviewerModel: null,
  options: {},
};

export async function loadTaskSettings(
  service: ServiceClient,
  workspaceId: string,
  task: string,
): Promise<AiTaskSettings> {
  const { data } = await service
    .from('ai_settings')
    .select('mode, primary_provider, primary_model, reviewer_provider, reviewer_model, options')
    .eq('workspace_id', workspaceId)
    .eq('task', task)
    .maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  const primary = (data.primary_provider as Provider) ?? 'anthropic';
  return {
    mode: (data.mode as AiMode) ?? 'anthropic',
    primaryProvider: primary,
    primaryModel: (data.primary_model as string | null) ?? null,
    // Reviewer defaults to "the other" provider so collaboration is a
    // genuine second opinion even when unconfigured.
    reviewerProvider:
      (data.reviewer_provider as Provider | null) ??
      (primary === 'anthropic' ? 'openai' : 'anthropic'),
    reviewerModel: (data.reviewer_model as string | null) ?? null,
    options: (data.options as Record<string, unknown>) ?? {},
  };
}

export async function loadSkills(
  service: ServiceClient,
  workspaceId: string,
  task: string,
): Promise<Skill[]> {
  const { data } = await service
    .from('skills')
    .select('name, content, applies_to, enabled, sort_order')
    .eq('workspace_id', workspaceId)
    .eq('enabled', true)
    .order('sort_order', { ascending: true });
  if (!data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[])
    .filter((s) => {
      const applies = (s.applies_to as string[] | null) ?? [];
      return applies.length === 0 || applies.includes(task);
    })
    .map((s) => ({ name: s.name as string, content: s.content as string }));
}

/** Profile docs for prompt injection: the agency doc (client_id null)
 * always applies; the client doc only when the job is client-scoped.
 * Agency doc sorts first so the client doc can override it. */
export async function loadProfiles(
  service: ServiceClient,
  workspaceId: string,
  clientId?: string | null,
): Promise<ProfileDoc[]> {
  let q = service
    .from('profile_docs')
    .select('client_id, content')
    .eq('workspace_id', workspaceId);
  q = clientId ? q.or(`client_id.is.null,client_id.eq.${clientId}`) : q.is('client_id', null);
  const { data } = await q;
  if (!data) return [];
  // deno-lint-ignore no-explicit-any
  return (data as any[])
    .map((p) => ({
      scope: (p.client_id ? 'client' : 'agency') as ProfileDoc['scope'],
      content: (p.content as string) ?? '',
    }))
    .sort((a, b) => (a.scope === b.scope ? 0 : a.scope === 'agency' ? -1 : 1));
}

export function totalStepsFor(mode: AiMode): number {
  return mode === 'collaboration' ? 3 : 1;
}

/** Mark a job failed (best-effort — a fail-marking that itself fails is
 * only logged, never thrown). */
export async function failJob(
  service: ServiceClient,
  jobId: string,
  error: string,
): Promise<void> {
  const { error: updErr } = await service
    .from('jobs')
    .update({ status: 'failed', error, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (updErr) console.error(`[failJob] could not mark ${jobId} failed:`, updErr.message);
}

/** Hand a freshly-inserted 'pending' job to run-job. run-job 202s before
 * doing work, so an ok response only confirms hand-off. Crucially, if the
 * handoff *throws* (DNS/connection error) or returns non-ok, this marks the
 * job failed — otherwise the row would sit 'pending' forever, since nothing
 * re-dispatches pending jobs. Shared by enqueue-job and cron-dispatch. */
export async function handoffToRunJob(
  service: ServiceClient,
  jobId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await invokeInternal('run-job', { job_id: jobId, step: 0 });
    if (resp.ok) return { ok: true };
    const detail = await resp.text().catch(() => '');
    const error = `Failed to start job runner (${resp.status}) ${detail.slice(0, 200)}`.trim();
    await failJob(service, jobId, error);
    return { ok: false, error };
  } catch (e) {
    const error = `Failed to reach job runner: ${(e as Error).message}`;
    await failJob(service, jobId, error);
    return { ok: false, error };
  }
}

/** What a task needs to tell the orchestrator to run it. */
export interface OrchestratedPromptSpec {
  /** Full system prompt (skills already appended by the task builder). */
  system: string;
  /** The generation prompt. Also shown to the reviewer/refiner so they
   * judge against the real output requirements. */
  user: string;
  /** Task-specific review checklist (what to look for). */
  reviewInstructions: string;
  /** Parse the final text as JSON (extractJson on Anthropic). */
  json: boolean;
  llmOptions?: LlmOptions;
  /** Optional post-processing applied by run-job to the final result
   * (dedupe, reshaping, persisting to domain tables) before it's stored
   * on the jobs row. May be async. */
  // deno-lint-ignore no-explicit-any
  finalize?: (result: any) => any | Promise<any>;
}

export interface StepOutcome {
  done: boolean;
  /** New jobs.state when not done. */
  // deno-lint-ignore no-explicit-any
  state?: any;
  /** Final result when done. */
  // deno-lint-ignore no-explicit-any
  result?: any;
  progress: number;
  message: string;
}

interface CollabState {
  // deno-lint-ignore no-explicit-any
  draft?: any;
  review?: string;
}

export async function runOrchestratedStep(args: {
  service: ServiceClient;
  workspaceId: string;
  jobId: string;
  task: string;
  settings: AiTaskSettings;
  spec: OrchestratedPromptSpec;
  step: number;
  state: CollabState | null;
}): Promise<StepOutcome> {
  const { service, workspaceId, jobId, task, settings, spec, step, state } = args;
  const track = { service, workspaceId, jobId, task };

  if (settings.mode !== 'collaboration') {
    const result = await callLlm(
      settings.primaryProvider,
      settings.primaryModel,
      [
        { role: 'system', content: spec.system },
        { role: 'user', content: spec.user },
      ],
      { ...spec.llmOptions, jsonMode: spec.json },
    );
    await recordUsage(service, { ...track, result });
    return {
      done: true,
      result: spec.json ? extractJson(result.text) : result.text,
      progress: 100,
      message: 'Done',
    };
  }

  // Collaboration: 3 steps, one call each.
  if (step === 0) {
    const result = await callLlm(
      settings.primaryProvider,
      settings.primaryModel,
      [
        { role: 'system', content: spec.system },
        { role: 'user', content: spec.user },
      ],
      { ...spec.llmOptions, jsonMode: spec.json },
    );
    await recordUsage(service, { ...track, result });
    const draft = spec.json ? extractJson(result.text) : result.text;
    return {
      done: false,
      state: { draft },
      progress: 40,
      message: 'Draft ready — peer review in progress',
    };
  }

  if (step === 1) {
    const draft = state?.draft;
    const reviewPrompt = `Review this AI-generated output against its original task.

## ORIGINAL TASK GIVEN TO THE OTHER AI
${spec.user}

## GENERATED OUTPUT TO REVIEW
${typeof draft === 'string' ? draft : JSON.stringify(draft, null, 2)}

## YOUR TASK
${spec.reviewInstructions}

Be specific - reference the exact items that need work.`;
    const result = await callLlm(
      settings.reviewerProvider,
      settings.reviewerModel,
      [
        { role: 'system', content: REVIEW_SYSTEM_PROMPT },
        { role: 'user', content: reviewPrompt },
      ],
      spec.llmOptions,
    );
    await recordUsage(service, { ...track, result });
    return {
      done: false,
      state: { draft, review: result.text },
      progress: 70,
      message: 'Review complete — refining final version',
    };
  }

  // step === 2: refine. On a parse failure, fall back to the draft — the
  // donor app does the same rather than failing the whole generation.
  const draft = state?.draft;
  const refinementPrompt = `Refine this output based on the peer review.

## ORIGINAL TASK
${spec.user}

## ORIGINAL OUTPUT
${typeof draft === 'string' ? draft : JSON.stringify(draft, null, 2)}

## PEER REVIEW FEEDBACK
${state?.review ?? 'No feedback available.'}

## YOUR TASK
Create a refined version that:
1. Keeps what was praised in the review
2. Fixes ALL issues mentioned
3. Follows the original task's output requirements EXACTLY (structure, counts, character limits)

Return the complete refined output${spec.json ? ' as valid JSON in the same structure as the original' : ''}.`;

  const result = await callLlm(
    settings.primaryProvider,
    settings.primaryModel,
    [
      { role: 'system', content: REFINEMENT_SYSTEM_PROMPT },
      { role: 'user', content: refinementPrompt },
    ],
    { ...spec.llmOptions, jsonMode: spec.json },
  );
  await recordUsage(service, { ...track, result });

  if (spec.json) {
    try {
      return { done: true, result: extractJson(result.text), progress: 100, message: 'Done' };
    } catch (_e) {
      console.error('[orchestrator] refinement parse failed, falling back to draft');
      return { done: true, result: draft, progress: 100, message: 'Done (draft kept)' };
    }
  }
  return { done: true, result: result.text, progress: 100, message: 'Done' };
}
