import type {
  AdAccount,
  AdBrief,
  AdPerfTreeNode,
  ApprovalItem,
  Asset,
  BrandComparison,
  BrandIntelligenceStats,
  BrandProfile,
  BrandTakeaway,
  Campaign,
  CampaignDetail,
  Client,
  ClientCard,
  ClientHeader,
  ClientKpis,
  ClientPerfRow,
  Competitor,
  BrandRule,
  GapAngle,
  Location,
  QueuedPost,
  ScrapedDomain,
  ScrapedPage,
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
  getBrandProfile(id: string): Promise<BrandProfile | null>;
  listClientCards(): Promise<ClientCard[]>;

  listClientPerf(): Promise<ClientPerfRow[]>;
  listCampaigns(): Promise<Campaign[]>;
  listPostsWeek(): Promise<WeekPostsDay[]>;
  listUrgent(): Promise<UrgentIssue[]>;
  listPostsQueue(): Promise<QueuedPost[]>;
  listCompetitors(): Promise<Competitor[]>;
  listCompetitorsForClient(clientId: string): Promise<Competitor[]>;
  listAssets(): Promise<Asset[]>;
  listAssetsForClient(clientId: string): Promise<Asset[]>;
  listDomains(): Promise<ScrapedDomain[]>;
  listDomainsForClient(clientId: string): Promise<ScrapedDomain[]>;
  listScrapedPagesForClient(clientId: string): Promise<ScrapedPage[]>;
  listAdAccountsForClient(clientId: string): Promise<AdAccount[]>;
  listLocationsForClient(clientId: string): Promise<Location[]>;
  listAdPerfTree(): Promise<AdPerfTreeNode[]>;
  getCampaignDetail(campaignId: string): Promise<CampaignDetail | null>;
  getAdBrief(clientId: string): Promise<AdBrief | null>;
  getBrandIntelligenceStats(): Promise<BrandIntelligenceStats>;
  getBrandTakeaway(): Promise<BrandTakeaway>;
  getBrandComparison(clientId: string): Promise<BrandComparison | null>;
  listGapAnglesForClient(clientId: string): Promise<GapAngle[]>;
  listBrandRules(): Promise<BrandRule[]>;
  listApprovals(): Promise<ApprovalItem[]>;
}
