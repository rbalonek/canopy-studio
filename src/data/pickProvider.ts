import { mockDataProvider } from './mockProvider';
import type { DataProvider } from './provider';
import { createSupabaseDataProvider } from './supabaseProvider';

/**
 * Pick the DataProvider at app boot from the `VITE_DATA_PROVIDER` env var.
 * "mock" (default) uses in-memory fixtures; "supabase" constructs a real
 * Supabase client. supabaseProvider is ESM-safe at import time — the
 * Supabase client is only created when the factory runs.
 */
export function pickProvider(): DataProvider {
  if (import.meta.env.VITE_DATA_PROVIDER === 'supabase') {
    return createSupabaseDataProvider();
  }
  return mockDataProvider;
}
