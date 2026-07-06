// Background-job client: enqueue via the enqueue-job Edge Function, then
// poll the jobs row every 2s until it completes or fails (the donor
// app's polling UX). Job rows are readable under RLS for workspace
// members, so polling is a plain select.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../auth/supabaseClient';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobRow<TResult = unknown> {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  progress_message: string | null;
  result: TResult | null;
  error: string | null;
  created_at: string;
}

const POLL_MS = 2000;

export async function enqueueJob(args: {
  type: string;
  workspaceId: string;
  clientId?: string;
  input?: Record<string, unknown>;
}): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase.functions.invoke('enqueue-job', {
    body: {
      type: args.type,
      workspace_id: args.workspaceId,
      client_id: args.clientId,
      input: args.input ?? {},
    },
  });
  if (error) throw new Error(error.message ?? 'Failed to enqueue job');
  if (!data?.ok || !data?.job_id) throw new Error(data?.error ?? 'Failed to enqueue job');
  return data.job_id as string;
}

/**
 * Poll one job until it reaches a terminal state. Pass null to idle.
 * Returns the live row plus convenience flags.
 */
export function useJob<TResult = unknown>(jobId: string | null): {
  job: JobRow<TResult> | null;
  running: boolean;
  failed: boolean;
  completed: boolean;
  /** Eased 0–100 for the UI. Follows real backend progress when it advances
   * (e.g. collaboration mode's 40/70/100) and otherwise creeps toward a cap so
   * a single-step job doesn't sit at 0% until it snaps to done. */
  displayProgress: number;
} {
  const [job, setJob] = useState<JobRow<TResult> | null>(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setJob(null);
    if (!jobId || !supabase) return;

    let cancelled = false;

    async function poll() {
      if (cancelled || !supabase || !jobId) return;
      const { data } = await supabase
        .from('jobs')
        .select('id, type, status, progress, progress_message, result, error, created_at')
        .eq('id', jobId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const row = data as unknown as JobRow<TResult>;
        setJob(row);
        if (row.status === 'completed' || row.status === 'failed') return;
      }
      timerRef.current = window.setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [jobId]);

  // Reset the eased bar whenever a new job starts.
  useEffect(() => {
    setDisplayProgress(0);
  }, [jobId]);

  // Real backend progress always wins immediately: snap to 100 on completion,
  // and never show less than what the row reports (collaboration 40/70/100).
  useEffect(() => {
    if (!job) return;
    if (job.status === 'completed') {
      setDisplayProgress(100);
      return;
    }
    setDisplayProgress((d) => Math.max(d, job.progress));
  }, [job?.progress, job?.status]);

  // While in flight with no finer signal, ease toward a cap (never reaching
  // 100 artificially) so the bar always shows forward motion.
  useEffect(() => {
    const inFlight = !!job && (job.status === 'pending' || job.status === 'processing');
    if (!inFlight) return;
    const CAP = 90;
    const id = window.setInterval(() => {
      setDisplayProgress((d) => (d >= CAP ? d : Math.min(CAP, d + Math.max(1, (CAP - d) * 0.08))));
    }, 500);
    return () => window.clearInterval(id);
  }, [job?.status]);

  return {
    job,
    running: !!job && (job.status === 'pending' || job.status === 'processing'),
    failed: job?.status === 'failed',
    completed: job?.status === 'completed',
    displayProgress,
  };
}

/** enqueue + poll in one hook — the common "click generate" shape. */
export function useJobRunner<TResult = unknown>(): {
  start: (args: {
    type: string;
    workspaceId: string;
    clientId?: string;
    input?: Record<string, unknown>;
  }) => Promise<void>;
  reset: () => void;
  job: JobRow<TResult> | null;
  running: boolean;
  failed: boolean;
  completed: boolean;
  displayProgress: number;
  startError: string | null;
} {
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const poll = useJob<TResult>(jobId);

  const start = useCallback(
    async (args: {
      type: string;
      workspaceId: string;
      clientId?: string;
      input?: Record<string, unknown>;
    }) => {
      setStartError(null);
      setJobId(null);
      setStarting(true);
      try {
        const id = await enqueueJob(args);
        setJobId(id);
      } catch (e) {
        setStartError(e instanceof Error ? e.message : String(e));
      } finally {
        setStarting(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setJobId(null);
    setStartError(null);
  }, []);

  return { start, reset, ...poll, running: starting || poll.running, startError };
}
