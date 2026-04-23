import { CAMPAIGNS, CLIENTS, CLIENT_PERF, COMPETITORS, POSTS_QUEUE, POSTS_WEEK, URGENT } from './mock';
import type { DataProvider } from './provider';

export const mockDataProvider: DataProvider = {
  async listClients() {
    return CLIENTS;
  },
  async getClient(id) {
    return CLIENTS.find((c) => c.id === id) ?? null;
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
