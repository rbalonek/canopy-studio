export type Industry =
  | 'Dental / Healthcare'
  | 'Fitness / Wellness'
  | 'Automotive'
  | 'Retail / E-commerce'
  | 'Food & Beverage'
  | 'Professional Services'
  | 'Optometry'
  | 'Home Services';

export type Location = {
  id: string;
  name: string;
};

export type Client = {
  id: string;
  name: string;
  industry: Industry;
  /** Brand-completeness 0-100 */
  complete: number;
  parent?: boolean;
  locations?: Location[];
};

export type CampaignStatus = 'Active' | 'Paused' | 'Draft' | 'Approved' | 'Scheduled' | 'Published' | 'Error';

export type ClientPerfRow = {
  name: string;
  spend: string;
  conv: number;
  roas: string;
  cpl: string;
  /** Seed for sparkline. */
  spark: number;
  status: CampaignStatus;
  /** Week-over-week delta percent */
  delta: number;
};

export type Campaign = {
  id: string;
  name: string;
  strategy: 'Lead Gen' | 'ATC' | 'Purchase' | 'Traffic' | 'Video' | 'Warm-up' | 'VC';
  spend: string;
  conv: number;
  roas: string;
  cpl: string;
  status: CampaignStatus;
};

export type PostStatus = 'Published' | 'Scheduled' | 'Draft' | 'Approved' | 'Error';

export type WeekPostsDay = {
  day: number;
  list: { status: PostStatus; fmt: 'Post' | 'Reel' | 'Carousel'; client: string }[];
};

export type UrgentIssue = {
  sev: 'red' | 'amber';
  title: string;
  body: string;
};

export type QueuedPost = {
  thumb: number;
  client: string;
  chan: ('fb' | 'ig')[];
  when: string;
  fmt: 'Post' | 'Reel' | 'Carousel';
  status: 'Queued' | 'Publishing' | 'Published' | 'Failed';
};

export type Competitor = {
  domain: string;
  industry: string;
  since: string;
  velocity: number;
  sov: number;
  pillars: string[];
};

export type ClientCardStats = {
  mtdSpend: string;
  activeCampaigns: number;
  postsPerWeek: number;
};

export type ClientCard = Client & ClientCardStats;
