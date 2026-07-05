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
import { serviceClient } from '../_shared/auth.ts';
import { invokeInternal, isInternalCall } from '../_shared/internal.ts';

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
    default:
      console.error(`[cron-dispatch] unknown task: ${task}`);
  }
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
