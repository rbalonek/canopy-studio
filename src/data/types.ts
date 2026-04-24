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
  address: string;
  mtdSpend: string;
  activeCampaigns: number;
  postsPerWeek: number;
  /** Brand completeness 0-100 */
  complete: number;
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

export type AdIdea = { title: string; body: string };

export type AdDirection = { title: string; body: string; selected?: boolean };

export type AdVariantImage = {
  kind: 'photo' | 'offer' | 'product' | 'bg';
  headline: string;
  /** Seed for deterministic AdThumb rendering. */
  seed: number;
};

/**
 * AI-grounded brief seed for one client's Ad Studio session. Content here
 * is what Claude would generate from the client's brand profile + top
 * performers — for now it's static mock content keyed to the client. The
 * user's selections (tone / prompt edits / imgMode / gen) are view state.
 */
export type AdBrief = {
  clientId: string;
  /** Subtitle under the page title, e.g. "Lead Gen · FB + IG". */
  subtitle: string;
  /** Default text pre-filled into the prompt textarea. */
  promptDraft: string;
  ideas: AdIdea[];
  directions: AdDirection[];
  /** Four pre-generated headline variants shown in Step 3. */
  headlines: string[];
  /** Four pre-generated image variants shown in Step 3. */
  images: AdVariantImage[];
  /** Reference-image metadata when pre-attached. */
  reference: { fileName: string; sizeLabel: string; dims: string; analysis: string } | null;
};

export type AdKpi = {
  label: string;
  /** Display value — "$4,820", "284K", "1.13%", "Avg", etc. */
  value: string;
  /** Percent delta vs prior period; 0 when the metric is non-numeric (Quality/Engagement). */
  delta: number;
  /** Seed for deterministic sparkline. */
  seed: number;
};

export type AdSet = {
  id: string;
  campaignId: string;
  name: string;
  spend: string;
  conv: number;
  /** "$93" or "—" when no conversions. */
  cpl: string;
  ctr: string;
  /** 0-100 CPL bar fill relative to benchmark; 0 hides the bar. */
  cplPct: number;
  /** Sparkline seed for the trend column. */
  sparkSeed: number;
  trendUp: boolean;
  status: CampaignStatus;
};

export type AdInsightPriority = 'High priority' | 'Medium' | 'Low';

export type AdInsight = {
  priority: AdInsightPriority;
  /** Border accent: maps to the same pill color. */
  accent: 'red' | 'amber' | 'green';
  title: string;
  body: string;
  /** Optional action buttons shown under the insight. */
  actions: { label: string; style: 'ai' | 'default' | 'ghost' }[];
};

export type CampaignDetail = {
  id: string;
  clientId: string;
  name: string;
  strategy: Campaign['strategy'];
  status: CampaignStatus;
  /** META account id the campaign lives under. */
  accountId: string;
  /** Client display name for the header. */
  clientName: string;
  lastRefreshLabel: string;
  kpis: AdKpi[];
  adSets: AdSet[];
  insights: AdInsight[];
};

export type AdPerfTreeNode = {
  id: string;
  /** Depth 0–4. 0=root, 1=client, 2=ad account, 3=campaign, 4=ad set. */
  lvl: number;
  label: string;
  /** Displayed on the right, e.g. "$4,820". */
  spend: string;
  icon?: string;
  /** True for ad-account rows so the id renders in monospaced type. */
  mono?: boolean;
  /** Campaign id when this node selects a campaign in the detail panel. */
  campaignId?: string;
};

export type AdAccountStatus = 'Active' | 'Refreshing' | 'Excluded' | 'Disconnected';

export type AdAccount = {
  id: string;
  clientId: string;
  /** Display name, e.g. "Acme Dental — Downtown". */
  name: string;
  /** META account id, e.g. "act_139204882". */
  accountId: string;
  currency: string;
  status: AdAccountStatus;
  activeCampaigns: number;
  /** Human-readable MTD spend for the account, or "—" when excluded. */
  mtdSpend: string;
  /** "8m ago" / "in progress" / "—". */
  lastRefreshLabel: string;
  /** Populated only when status === 'Excluded'. */
  excludedAt: string | null;
  excludedBy: string | null;
  excludedReason: string | null;
};

export type DomainHealth = 'Healthy' | 'Warnings' | 'Stale' | 'Error';
export type SitemapStatus = 'Discovered' | 'Partial' | 'Failed';
export type ScrapeAnalysisStatus = 'Done' | 'Stale' | 'Failed' | 'Pending';

export type ScrapedDomain = {
  id: string;
  clientId: string;
  /** Bare domain, e.g. "acmedental.com". */
  domain: string;
  health: DomainHealth;
  sitemapStatus: SitemapStatus;
  pageCount: number;
  /** Human-readable last-scraped ago, e.g. "2d ago". "—" when never scraped. */
  lastScrapedLabel: string;
};

export type ScrapedPage = {
  id: string;
  clientId: string;
  domainId: string;
  /** URL path, e.g. "/services/invisalign". */
  path: string;
  title: string;
  words: number;
  lastScrapedLabel: string;
  analysisStatus: ScrapeAnalysisStatus;
};

export type AssetKind = 'Logo' | 'Photo' | 'Video' | 'Doc';
export type AssetAnalysisStatus = 'Analyzed' | 'Pending' | 'Failed';

export type Asset = {
  id: string;
  clientId: string;
  /** File name as shown in the grid, e.g. "family-saturdays-hero.jpg". */
  name: string;
  kind: AssetKind;
  analysisStatus: AssetAnalysisStatus;
  /** Human-readable size, e.g. "1.4 MB". */
  sizeLabel: string;
  /** Human-readable upload date, e.g. "Mar 12". */
  dateLabel: string;
  /** AI analysis summary — only present when analysisStatus === 'Analyzed'. */
  analysisSummary: string | null;
};

export type Competitor = {
  /** Client this competitor is tracked under. */
  clientId: string;
  domain: string;
  industry: string;
  since: string;
  velocity: number;
  sov: number;
  pillars: string[];
  /** Days ago a new landing page was detected on this competitor. Null when nothing new. */
  newPageDaysAgo: number | null;
};

/**
 * Workspace-level Brand Intelligence stats shown on the hero cards.
 * These aggregate across all clients in the current workspace.
 */
export type BrandIntelligenceStats = {
  domains: { count: number; pagesIndexed: number };
  competitors: { tracked: number; newPagesThisWeek: number };
  rules: { total: number; crossClient: number };
  assets: { total: number; aiAnalyzed: number };
};

export type BrandTakeaway = {
  body: string;
};

/**
 * A cell in a brand comparison table. Cells are heterogeneous — most are
 * plain text, but the visual-palette row renders swatches and the
 * content-cadence row renders a 12-week CreativeCadence bar strip.
 * `gap: true` marks a cell where `self` is behind and a "Draft ad to
 * close gap" affordance should appear.
 */
export type ComparisonCell =
  | { type: 'text'; value: string; gap?: boolean }
  | { type: 'palette'; colors: string[] }
  | { type: 'cadence'; seed: number; gap?: boolean };

export type ComparisonRow = {
  dimension: string;
  /** First cell is the client's own value; the rest are competitor values. */
  cells: ComparisonCell[];
};

export type BrandComparison = {
  clientId: string;
  selfName: string;
  competitorDomains: string[];
  rows: ComparisonRow[];
};

/**
 * A positioning gap or angle surfaced by Claude's analysis of
 * competitor content. Rendered on the Gaps & Angles tab with a
 * confidence pill and a "Draft ad from this angle →" CTA.
 */
export type GapAngle = {
  id: string;
  clientId: string;
  title: string;
  /** Confidence 0-100. */
  confidence: number;
  evidence: string;
};

export type ClientCardStats = {
  mtdSpend: string;
  activeCampaigns: number;
  postsPerWeek: number;
};

export type ClientCard = Client & ClientCardStats;

export type KpiValue = {
  value: string;
  delta: number;
  /** Seed for deterministic sparkline. */
  seed: number;
};

export type ClientKpis = {
  spend: KpiValue;
  conversions: KpiValue;
  roas: KpiValue;
  cpl: KpiValue;
};

/** Meta-data shown in the detail header. Ad account id may be absent. */
export type ClientHeader = {
  id: string;
  name: string;
  industry: Industry;
  locationCount: number;
  /** Primary META ad account id, e.g. act_139204882. Null if none connected. */
  adAccountId: string | null;
};

/**
 * Editable brand profile shown on the Brand tab. All fields may be empty
 * when a client hasn't completed brand onboarding yet.
 */
export type BrandProfile = {
  description: string;
  voice: string;
  dos: string[];
  donts: string[];
  /** Object key / URL for the uploaded logo, or null when not uploaded. */
  logoUrl: string | null;
};
