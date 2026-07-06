// cron-dispatch
//
// The single entry point pg_cron POSTs to (see the metrics_history_cron
// migration). Internal-secret only. Fans a named task out across the
// relevant rows, invoking sibling Edge Functions per item so no single
// invocation does unbounded work itself.
//
// Tasks:
//   refresh_all    — meta-refresh-client for every client that has a
//                    resolvable ad account (locations.ad_account_id or a
//                    legacy meta_accounts row).
//   analysis_all   — weekly account_analysis job per client with campaign
//                    data (added with the suggestions phase).
//   reports_<c>    — daily|weekly|monthly report sends (reports phase).
//
// Responds 202 immediately and works in the background. Items run with
// small concurrency; per-item failures are logged, never fatal.

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import { serviceClient, type ServiceClient } from '../_shared/auth.ts';
import { invokeInternal, isInternalCall } from '../_shared/internal.ts';
import { handoffToRunJob, loadTaskSettings, totalStepsFor } from '../_shared/ai/orchestrator.ts';
import { settingsTaskFor } from '../_shared/ai/taskSpecs.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const CONCURRENCY = 2;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!isInternalCall(req)) return json({ ok: false, error: 'Forbidden' }, 403);

  let task: string;
  try {
    task = ((await req.json()) as { task?: string }).task ?? '';
  } catch {
    return json({ ok: false, error: 'Invalid body' }, 400);
  }
  if (!task) return json({ ok: false, error: 'task is required' }, 400);

  const work = dispatch(task).catch((e) => {
    console.error(`[cron-dispatch] task ${task} failed:`, e);
  });
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }
  return json({ ok: true, accepted: true, task }, 202);
});

async function dispatch(task: string): Promise<void> {
  switch (task) {
    case 'refresh_all':
      await refreshAll();
      return;
    case 'analysis_all':
      await analysisAll();
      return;
    case 'reports_due':
      await reportsDue();
      return;
    default:
      console.error(`[cron-dispatch] unknown task: ${task}`);
  }
}

/** Insert a job row (service role — cron has no user) and hand it to
 * run-job, mirroring what enqueue-job does for browser callers. */
async function enqueueSystemJob(
  service: ServiceClient,
  args: { type: string; workspaceId: string; clientId?: string; input?: Record<string, unknown> },
): Promise<void> {
  const settings = await loadTaskSettings(service, args.workspaceId, settingsTaskFor(args.type));
  const { data: jobRow, error } = await service
    .from('jobs')
    .insert({
      workspace_id: args.workspaceId,
      client_id: args.clientId ?? null,
      type: args.type,
      status: 'pending',
      total_steps: totalStepsFor(settings.mode),
      progress: 0,
      progress_message: 'Queued (scheduled)',
      input: args.input ?? {},
    })
    .select('id')
    .single();
  if (error || !jobRow) {
    throw new Error(`job insert failed: ${error?.message}`);
  }
  // Marks the job failed if the hand-off can't reach run-job, so a scheduled
  // job never sits 'pending' forever.
  const handoff = await handoffToRunJob(service, jobRow.id);
  if (!handoff.ok) throw new Error(handoff.error ?? 'run-job handoff failed');
}

/** Weekly analysis for every client that has campaign data. */
async function analysisAll(): Promise<void> {
  const service = serviceClient();
  const { data } = await service
    .from('campaigns')
    .select('client_id, clients!inner(workspace_id)');
  const byClient = new Map<string, string>();
  for (const row of (data ?? []) as any[]) {
    byClient.set(row.client_id as string, row.clients.workspace_id as string);
  }

  console.log(`[cron-dispatch] analysis_all: ${byClient.size} client(s)`);
  await runWithConcurrency(Array.from(byClient.entries()), CONCURRENCY, async ([clientId, workspaceId]) => {
    try {
      await enqueueSystemJob(service, {
        type: 'account_analysis',
        workspaceId,
        clientId,
      });
      console.log(`[cron-dispatch] analysis queued for ${clientId}`);
    } catch (e) {
      console.error(`[cron-dispatch] analysis enqueue failed for ${clientId}:`, e);
    }
  });
}

/** Clients worth refreshing: any with a location ad account or a legacy
 * meta_accounts row. The refresh function still resolves tokens itself —
 * this list just avoids invoking it for clients with nothing configured. */
async function refreshAll(): Promise<void> {
  const service = serviceClient();
  const [locRes, legacyRes] = await Promise.all([
    service.from('locations').select('client_id').not('ad_account_id', 'is', null),
    service.from('meta_accounts').select('client_id').not('account_id', 'is', null),
  ]);
  const clientIds = new Set<string>();
  for (const row of (locRes.data ?? []) as any[]) clientIds.add(row.client_id as string);
  for (const row of (legacyRes.data ?? []) as any[]) clientIds.add(row.client_id as string);

  console.log(`[cron-dispatch] refresh_all: ${clientIds.size} client(s)`);
  await runWithConcurrency(Array.from(clientIds), CONCURRENCY, async (clientId) => {
    const resp = await invokeInternal('meta-refresh-client', { client_id: clientId });
    const body = await resp.text().catch(() => '');
    if (!resp.ok) {
      console.error(`[cron-dispatch] refresh ${clientId} failed (${resp.status}): ${body.slice(0, 300)}`);
    } else {
      console.log(`[cron-dispatch] refreshed ${clientId}: ${body.slice(0, 200)}`);
    }
  });
}

/** Fires the report settings due today: daily always, weekly on Mondays,
 * monthly on the 1st. Runs at 07:00 UTC, after the 06:00 refresh, so
 * yesterday's metrics are in. */
async function reportsDue(): Promise<void> {
  const service = serviceClient();
  const now = new Date();
  const due: string[] = ['daily'];
  if (now.getUTCDay() === 1) due.push('weekly');
  if (now.getUTCDate() === 1) due.push('monthly');

  const { data } = await service
    .from('report_settings')
    .select('id, workspace_id, client_id, cadence')
    .eq('enabled', true)
    .in('cadence', due);

  console.log(`[cron-dispatch] reports_due (${due.join(', ')}): ${data?.length ?? 0} report(s)`);
  await runWithConcurrency((data ?? []) as any[], CONCURRENCY, async (rs) => {
    try {
      await enqueueSystemJob(service, {
        type: 'send_report',
        workspaceId: rs.workspace_id as string,
        clientId: rs.client_id as string,
        input: { report_settings_id: rs.id },
      });
    } catch (e) {
      console.error(`[cron-dispatch] report enqueue failed for ${rs.id}:`, e);
    }
  });
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      try {
        await fn(item);
      } catch (e) {
        console.error('[cron-dispatch] item failed:', e);
      }
    }
  });
  await Promise.all(workers);
}
