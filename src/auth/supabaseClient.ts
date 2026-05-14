import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Singleton Supabase client used by both the auth layer and the
 * Supabase-backed DataProvider. Null when the env vars aren't set
 * (e.g. running /dev/* offline). Callers that strictly need a client
 * should use {@link requireSupabase}.
 */
export const supabase: SupabaseClient | null = URL && KEY ? createClient(URL, KEY) : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local',
    );
  }
  return supabase;
}
