// run-job
//
// Executes exactly ONE step of a background job per invocation, then
// self-invokes for the next step. This is the serverless answer to the
// donor app's in-process queue: no invocation ever runs more than one
// LLM call, so each stays far inside the Edge Function wall-clock cap
// no matter how many steps a collaboration flow has.
//
// Auth: internal callers only (enqueue-job, itself, cron-dispatch) via
// X-Internal-Secret. Never exposed to the browser — the frontend talks
// to enqueue-job and polls the jobs table.
//
// Flow per invocation:
//   1. Respond 202 immediately; real work continues via
//      EdgeRuntime.waitUntil (background task).
//   2. Claim the job step optimistically (status guard) so a duplicate
//      delivery can't run the same step twice.
//   3. Build the task's prompt spec, run the step via the orchestrator.
//   4. Persist state/progress. If not done, invoke self with step+1
//      (that call also 202s instantly). If done, store result.
//   5. Any throw → status 'failed' + error message on the row.

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/auth.ts';
import { invokeInternal, isInternalCall } from '../_shared/internal.ts';
import { getSpecBuilder, type JobRow } from '../_shared/ai/taskSpecs.ts';
import { loadTaskSettings, runOrchestratedStep } from '../_shared/ai/orchestrator.ts';

// The Edge Runtime global for background tasks; typed loosely because the
// Deno types don't ship it.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

interface RunRequest {
  job_id: string;
  step: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!isInternalCall(req)) {
    return json({ ok: false, error: 'Forbidden' }, 403);
  }

  let body: RunRequest;
  try {
    body = (await req.json()) as RunRequest;
  } catch {
    return json({ ok: false, error: 'Invalid body' }, 400);
  }
  if (!body?.job_id || typeof body.step !== 'number') {
    return json({ ok: false, error: 'job_id and step are required' }, 400);
  }

  const work = processStep(body.job_id, body.step).catch((e) => {
    console.error(`[run-job] unhandled failure for job ${body.job_id}:`, e);
  });

  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
  } else {
    // Local `supabase functions serve` may not expose EdgeRuntime; run
    // inline so behavior stays correct (just slower to respond).
    await work;
  }

  return json({ ok: true, accepted: true }, 202);
});

async function processStep(jobId: string, step: number): Promise<void> {
  const service = serviceClient();

  // Claim: pending → processing on step 0, or advance the step counter on
  // later steps. The .eq guards make replays no-ops.
  const claim = await service
    .from('jobs')
    .update({
      status: 'processing',
      step,
      progress_message: step === 0 ? 'Starting' : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('status', step === 0 ? 'pending' : 'processing')
    .eq('step', step === 0 ? 0 : step - 1)
    .select('id, workspace_id, client_id, type, input, state, total_steps')
    .maybeSingle();

  if (claim.error) {
    console.error(`[run-job] claim failed for ${jobId}: ${claim.error.message}`);
    return;
  }
  if (!claim.data) {
    // Someone else ran this step already, or the job was failed/completed.
    console.log(`[run-job] step ${step} of ${jobId} not claimable — skipping`);
    return;
  }

  const job = claim.data as unknown as JobRow & { state: any; total_steps: number };

  try {
    const builder = getSpecBuilder(job.type);
    if (!builder) throw new Error(`No handler for job type: ${job.type}`);

    const settings = await loadTaskSettings(service, job.workspace_id, job.type);
    const spec = await builder(service, job);

    const outcome = await runOrchestratedStep({
      service,
      workspaceId: job.workspace_id,
      jobId: job.id,
      task: job.type,
      settings,
      spec,
      step,
      state: job.state ?? null,
    });

    if (outcome.done) {
      const finalResult = spec.finalize ? spec.finalize(outcome.result) : outcome.result;
      await service
        .from('jobs')
        .update({
          status: 'completed',
          progress: 100,
          progress_message: outcome.message,
          result: finalResult ?? null,
          state: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
      return;
    }

    await service
      .from('jobs')
      .update({
        progress: outcome.progress,
        progress_message: outcome.message,
        state: outcome.state ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    const next = await invokeInternal('run-job', { job_id: jobId, step: step + 1 });
    if (!next.ok) {
      throw new Error(`Failed to chain step ${step + 1} (${next.status})`);
    }
  } catch (e) {
    console.error(`[run-job] job ${jobId} step ${step} failed:`, e);
    await service
      .from('jobs')
      .update({
        status: 'failed',
        error: (e as Error).message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}
