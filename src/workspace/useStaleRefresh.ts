// On-login staleness check: reads always come from Supabase; if the
// newest campaign data in the workspace is older than the threshold,
// kick a background Meta refresh for the stale clients. Fires at most
// once per workspace per browser session — the daily cron is the real
// keeper of freshness, this just covers "cron hasn't run since I last
// looked" without ever blocking the UI.

import { useEffect } from 'react';
import { supabase } from '../auth/supabaseClient';

const STALE_MS = 12 * 60 * 60 * 1000;
const MAX_CLIENTS_PER_LOGIN = 5;

// Workspaces already checked this session.
const checked = new Set<string>();

export function useStaleRefresh(workspaceId: string | undefined): void {
  useEffect(() => {
    if (!workspaceId || !supabase || checked.has(workspaceId)) return;
    checked.add(workspaceId);

    (async () => {
      if (!supabase) return;
      const cutoff = new Date(Date.now() - STALE_MS).toISOString();
      const { data, error } = await supabase
        .from('campaigns')
        .select('client_id, last_refreshed_at, clients!inner(workspace_id)')
        .eq('clients.workspace_id', workspaceId)
        .lt('last_refreshed_at', cutoff);
      if (error || !data?.length) return;

      const staleClients = Array.from(
        new Set(data.map((r) => r.client_id as string)),
      ).slice(0, MAX_CLIENTS_PER_LOGIN);

      // Sequential on purpose — background freshness, not a fetch storm.
      for (const clientId of staleClients) {
        try {
          await supabase.functions.invoke('meta-refresh-client', {
            body: { client_id: clientId },
          });
        } catch (e) {
          console.warn(`Background refresh failed for ${clientId}:`, e);
        }
      }
    })();
  }, [workspaceId]);
}
