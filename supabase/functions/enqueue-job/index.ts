// enqueue-job
//
// The single user-facing entry point for background AI work. Validates
// the caller's JWT + workspace membership, inserts a `jobs` row, then
// hands off to run-job (internal call). run-job responds 202 before
// doing the work, so this function returns quickly with the job id the
// frontend polls.

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import {
  assertClientAccess,
  assertWorkspaceMember,
  authenticate,
  serviceClient,
} from '../_shared/auth.ts';
import { isKnownJobType, settingsTaskFor } from '../_shared/ai/taskSpecs.ts';
import { handoffToRunJob, loadTaskSettings, totalStepsFor } from '../_shared/ai/orchestrator.ts';
import { billingBlockReason } from '../_shared/ai/usage.ts';

interface EnqueueRequest {
  type: string;
  workspace_id: string;
  client_id?: string;
  input?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as EnqueueRequest;
    if (!body?.type || !body?.workspace_id) {
      return json({ ok: false, error: 'type and workspace_id are required' }, 400);
    }
    if (!isKnownJobType(body.type)) {
      return json({ ok: false, error: `Unknown job type: ${body.type}` }, 400);
    }

    const caller = await authenticate(req);
    if (!caller) return json({ ok: false, error: 'Invalid session' }, 401);

    // Membership gate. When a client is in play, the client lookup both
    // proves access and pins the job to the client's actual workspace.
    let workspaceId = body.workspace_id;
    if (body.client_id) {
      const wsFromClient = await assertClientAccess(caller, body.client_id);
      if (!wsFromClient) {
        return json({ ok: false, error: 'Client not found or access denied' }, 403);
      }
      workspaceId = wsFromClient;
    } else {
      const isMember = await assertWorkspaceMember(caller, workspaceId);
      if (!isMember) return json({ ok: false, error: 'Workspace access denied' }, 403);
    }

    const service = serviceClient();

    // Billing gate: 402 with a human message the UI unwraps via
    // error.context. Workspaces without billing enabled are never blocked.
    const blocked = await billingBlockReason(service, workspaceId);
    if (blocked) return json({ ok: false, error: blocked }, 402);

    const settings = await loadTaskSettings(service, workspaceId, settingsTaskFor(body.type));

    const { data: jobRow, error: insertErr } = await service
      .from('jobs')
      .insert({
        workspace_id: workspaceId,
        client_id: body.client_id ?? null,
        type: body.type,
        status: 'pending',
        total_steps: totalStepsFor(settings.mode),
        progress: 0,
        progress_message: 'Queued',
        input: body.input ?? {},
        created_by: caller.userId,
      })
      .select('id')
      .single();
    if (insertErr || !jobRow) {
      return json({ ok: false, error: insertErr?.message ?? 'Failed to create job' }, 500);
    }

    // handoffToRunJob marks the job failed if the hand-off throws or errors,
    // so the row never sits 'pending' forever (nothing re-dispatches those).
    const handoff = await handoffToRunJob(service, jobRow.id);
    if (!handoff.ok) {
      return json({ ok: false, error: 'Failed to start job runner' }, 500);
    }

    return json({ ok: true, job_id: jobRow.id }, 202);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
