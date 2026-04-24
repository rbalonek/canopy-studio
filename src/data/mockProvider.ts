import {
  AD_ACCOUNTS,
  AD_BRIEFS,
  AD_PERF_TREE,
  ASSETS,
  BRAND_COMPARISONS,
  BRAND_INTEL_STATS,
  BRAND_PROFILES,
  BRAND_TAKEAWAY,
  GAP_ANGLES,
  CAMPAIGNS,
  CAMPAIGN_DETAILS,
  CLIENTS,
  CLIENT_CARD_STATS,
  CLIENT_KPIS,
  CLIENT_PERF,
  COMPETITORS,
  META_ACCOUNTS,
  POSTS_QUEUE,
  POSTS_WEEK,
  SCRAPED_DOMAINS,
  SCRAPED_PAGES,
  URGENT,
} from './mock';
import type { DataProvider } from './provider';

export const mockDataProvider: DataProvider = {
  async listClients() {
    return CLIENTS;
  },
  async getClient(id) {
    return CLIENTS.find((c) => c.id === id) ?? null;
  },
  async getClientHeader(id) {
    const c = CLIENTS.find((x) => x.id === id);
    if (!c) return null;
    return {
      id: c.id,
      name: c.name,
      industry: c.industry,
      locationCount: c.locations?.length ?? 0,
      adAccountId: META_ACCOUNTS[c.id] ?? null,
    };
  },
  async getClientKpis(id) {
    return CLIENT_KPIS[id] ?? null;
  },
  async getBrandProfile(id) {
    return BRAND_PROFILES[id] ?? null;
  },
  async listClientCards() {
    return CLIENTS.map((c) => ({
      ...c,
      ...(CLIENT_CARD_STATS[c.id] ?? { mtdSpend: '$—', activeCampaigns: 0, postsPerWeek: 0 }),
    }));
  },
  async listClientPerf() {
    return CLIENT_PERF;
  },
  async listCampaigns() {
    return CAMPAIGNS;
  },
  async listPostsWeek() {
    return POSTS_WEEK;
  },
  async listUrgent() {
    return URGENT;
  },
  async listPostsQueue() {
    return POSTS_QUEUE;
  },
  async listCompetitors() {
    return COMPETITORS;
  },
  async listCompetitorsForClient(clientId) {
    return COMPETITORS.filter((c) => c.clientId === clientId);
  },
  async listAssetsForClient(clientId) {
    return ASSETS.filter((a) => a.clientId === clientId);
  },
  async listDomains() {
    return SCRAPED_DOMAINS;
  },
  async listDomainsForClient(clientId) {
    return SCRAPED_DOMAINS.filter((d) => d.clientId === clientId);
  },
  async listScrapedPagesForClient(clientId) {
    return SCRAPED_PAGES.filter((p) => p.clientId === clientId);
  },
  async listAdAccountsForClient(clientId) {
    return AD_ACCOUNTS.filter((a) => a.clientId === clientId);
  },
  async listLocationsForClient(clientId) {
    const c = CLIENTS.find((x) => x.id === clientId);
    return c?.locations ?? [];
  },
  async listAdPerfTree() {
    return AD_PERF_TREE;
  },
  async getCampaignDetail(campaignId) {
    return CAMPAIGN_DETAILS[campaignId] ?? null;
  },
  async getAdBrief(clientId) {
    return AD_BRIEFS[clientId] ?? null;
  },
  async getBrandIntelligenceStats() {
    return BRAND_INTEL_STATS;
  },
  async getBrandTakeaway() {
    return BRAND_TAKEAWAY;
  },
  async getBrandComparison(clientId) {
    return BRAND_COMPARISONS[clientId] ?? null;
  },
  async listGapAnglesForClient(clientId) {
    return GAP_ANGLES.filter((g) => g.clientId === clientId);
  },
};
