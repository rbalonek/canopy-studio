import { createClient } from '@supabase/supabase-js';
import { mockDataProvider } from './mockProvider';
import type { DataProvider } from './provider';
import type {
  Client,
  ClientCard,
  ClientHeader,
  ClientKpis,
  ClientPerfRow,
  Location,
  UrgentIssue,
} from './types';

/**
 * Factory for the Supabase-backed DataProvider. No top-level side effects
 * — env check and createClient() only happen when this is called, which
 * means importing this module is free even when we're using the mock.
 *
 * Spreads the mock provider first so any method whose table hasn't been
 * migrated yet still returns fixture data — methods defined below override
 * the mock for tables that now live in Postgres.
 */
export function createSupabaseDataProvider(): DataProvider {
  const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!URL || !KEY) {
    throw new Error(
      'Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local',
    );
  }
  const supabase = createClient(URL, KEY);

  return {
    ...mockDataProvider,

    async listClients() {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          industry,
          complete,
          is_parent,
          locations (
            id,
            name,
            address,
            mtd_spend,
            active_campaigns,
            posts_per_week,
            complete
          )
        `)
        .order('name');
      if (error) throw error;
      return (data ?? []).map(toClient);
    },

    async getClient(id) {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          industry,
          complete,
          is_parent,
          locations (
            id,
            name,
            address,
            mtd_spend,
            active_campaigns,
            posts_per_week,
            complete
          )
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? toClient(data) : null;
    },

    async getClientHeader(id) {
      const { data: client, error } = await supabase
        .from('clients')
        .select('id, name, industry, locations(id)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!client) return null;

      const { data: meta } = await supabase
        .from('meta_accounts')
        .select('account_id')
        .eq('client_id', id)
        .maybeSingle();

      return {
        id: client.id,
        name: client.name,
        industry: client.industry as ClientHeader['industry'],
        locationCount: (client.locations as unknown as { id: string }[])?.length ?? 0,
        adAccountId: meta?.account_id ?? null,
      };
    },

    async getClientKpis(id) {
      const { data, error } = await supabase
        .from('client_kpis')
        .select('metric, value, delta, seed')
        .eq('client_id', id);
      if (error) throw error;
      if (!data || data.length === 0) return null;

      const out: ClientKpis = {
        spend:       { value: '—', delta: 0, seed: 0 },
        conversions: { value: '—', delta: 0, seed: 0 },
        roas:        { value: '—', delta: 0, seed: 0 },
        cpl:         { value: '—', delta: 0, seed: 0 },
      };
      for (const row of data) {
        const key = row.metric as keyof ClientKpis;
        if (key in out) {
          out[key] = { value: row.value, delta: row.delta, seed: row.seed };
        }
      }
      return out;
    },

    async listClientCards() {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          industry,
          complete,
          is_parent,
          locations (
            id,
            name,
            address,
            mtd_spend,
            active_campaigns,
            posts_per_week,
            complete
          ),
          client_card_stats (
            mtd_spend,
            active_campaigns,
            posts_per_week
          )
        `);
      if (error) throw error;
      return (data ?? []).map((row): ClientCard => {
        const client = toClient(row);
        const stats = row.client_card_stats as unknown as ClientCardStatsRow | ClientCardStatsRow[] | null;
        const s = Array.isArray(stats) ? stats[0] : stats;
        return {
          ...client,
          mtdSpend: s?.mtd_spend ?? '$—',
          activeCampaigns: s?.active_campaigns ?? 0,
          postsPerWeek: s?.posts_per_week ?? 0,
        };
      });
    },

    async listClientPerf() {
      const { data, error } = await supabase
        .from('client_perf')
        .select('client_id, spend, conv, roas, cpl, spark, status, delta, clients(name)');
      if (error) throw error;
      return (data ?? []).map((row): ClientPerfRow => {
        const clientName = (row.clients as unknown as { name: string } | null)?.name ?? row.client_id;
        return {
          name: clientName,
          spend: row.spend,
          conv: row.conv,
          roas: row.roas,
          cpl: row.cpl,
          spark: row.spark,
          status: row.status as ClientPerfRow['status'],
          delta: row.delta,
        };
      });
    },

    async listUrgent() {
      const { data, error } = await supabase
        .from('urgent_issues')
        .select('sev, title, body')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r): UrgentIssue => ({
        sev: r.sev as UrgentIssue['sev'],
        title: r.title,
        body: r.body,
      }));
    },
  };
}

// -- row → type mappers -----------------------------------------------------

type ClientRow = {
  id: string;
  name: string;
  industry: string;
  complete: number;
  is_parent: boolean;
  locations?: LocationRow[] | null;
};

type LocationRow = {
  id: string;
  name: string;
  address: string;
  mtd_spend: string;
  active_campaigns: number;
  posts_per_week: number;
  complete: number;
};

type ClientCardStatsRow = {
  mtd_spend: string;
  active_campaigns: number;
  posts_per_week: number;
};

function toClient(r: ClientRow): Client {
  const client: Client = {
    id: r.id,
    name: r.name,
    industry: r.industry as Client['industry'],
    complete: r.complete,
    parent: r.is_parent,
  };
  if (r.locations && r.locations.length > 0) {
    client.locations = r.locations.map(toLocation);
  }
  return client;
}

function toLocation(r: LocationRow): Location {
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    mtdSpend: r.mtd_spend,
    activeCampaigns: r.active_campaigns,
    postsPerWeek: r.posts_per_week,
    complete: r.complete,
  };
}
