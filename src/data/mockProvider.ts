import {
  CAMPAIGNS,
  CLIENTS,
  CLIENT_CARD_STATS,
  CLIENT_PERF,
  COMPETITORS,
  POSTS_QUEUE,
  POSTS_WEEK,
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
};
