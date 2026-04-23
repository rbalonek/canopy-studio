import type {
  Campaign,
  Client,
  ClientCard,
  ClientHeader,
  ClientKpis,
  ClientPerfRow,
  Competitor,
  QueuedPost,
  UrgentIssue,
  WeekPostsDay,
} from './types';

/**
 * Data access shape the app reads through. The mock impl is in-memory;
 * the real impl will be a Supabase-backed one. Keep method names stable so
 * the swap is a provider change, not a view change.
 */
export interface DataProvider {
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | null>;
  getClientHeader(id: string): Promise<ClientHeader | null>;
  getClientKpis(id: string): Promise<ClientKpis | null>;
  listClientCards(): Promise<ClientCard[]>;

  listClientPerf(): Promise<ClientPerfRow[]>;
  listCampaigns(): Promise<Campaign[]>;
  listPostsWeek(): Promise<WeekPostsDay[]>;
  listUrgent(): Promise<UrgentIssue[]>;
  listPostsQueue(): Promise<QueuedPost[]>;
  listCompetitors(): Promise<Competitor[]>;
}
