import type {
  AdAccount,
  AdBrief,
  AdPerfTreeNode,
  Asset,
  BrandComparison,
  BrandIntelligenceStats,
  BrandProfile,
  BrandTakeaway,
  Campaign,
  CampaignDetail,
  Client,
  ClientCardStats,
  ClientKpis,
  ClientPerfRow,
  Competitor,
  BrandRule,
  GapAngle,
  QueuedPost,
  ScrapedDomain,
  ScrapedPage,
  UrgentIssue,
  WeekPostsDay,
} from './types';

export const CLIENTS: Client[] = [
  {
    id: 'acme',
    name: 'Acme Dental',
    industry: 'Dental / Healthcare',
    complete: 86,
    parent: true,
    locations: [
      { id: 'acme-dt', name: 'Acme Dental — Downtown', address: '284 Ember Row',  mtdSpend: '$8,210', activeCampaigns: 6, postsPerWeek: 3, complete: 92 },
      { id: 'acme-mt', name: 'Acme Dental — Midtown',  address: '1420 Oak Blvd',  mtdSpend: '$6,420', activeCampaigns: 4, postsPerWeek: 2, complete: 81 },
      { id: 'acme-ws', name: 'Acme Dental — Westside', address: '55 Cedar Lane',  mtdSpend: '$3,790', activeCampaigns: 3, postsPerWeek: 2, complete: 74 },
    ],
  },
  { id: 'seaside', name: 'Seaside Yoga', industry: 'Fitness / Wellness', complete: 72 },
  {
    id: 'northside',
    name: 'Northside Auto Group',
    industry: 'Automotive',
    complete: 54,
    parent: true,
    locations: [
      { id: 'nsa-ford', name: 'Northside Ford', address: '9014 Route 44', mtdSpend: '$24,120', activeCampaigns: 5, postsPerWeek: 1, complete: 58 },
      { id: 'nsa-kia',  name: 'Northside Kia',  address: '9016 Route 44', mtdSpend: '$18,760', activeCampaigns: 4, postsPerWeek: 1, complete: 51 },
    ],
  },
  { id: 'bloom', name: 'Bloom & Vine Florist', industry: 'Retail / E-commerce', complete: 91 },
  { id: 'kettle', name: 'Kettle & Crumb Bakery', industry: 'Food & Beverage', complete: 44 },
  { id: 'harbor', name: 'Harbor Legal Partners', industry: 'Professional Services', complete: 66 },
  { id: 'pine', name: 'Pinecrest Family Dentistry', industry: 'Dental / Healthcare', complete: 38 },
  { id: 'lumen', name: 'Lumen Eyecare', industry: 'Optometry', complete: 78 },
  { id: 'summit', name: 'Summit Roofing Co.', industry: 'Home Services', complete: 60 },
];

export const CLIENT_PERF: ClientPerfRow[] = [
  { name: 'Acme Dental', spend: '$18,420', conv: 142, roas: '3.8x', cpl: '$48', spark: 3, status: 'Active', delta: 12.4 },
  { name: 'Seaside Yoga', spend: '$6,210', conv: 58, roas: '2.4x', cpl: '$31', spark: 7, status: 'Active', delta: -6.1 },
  { name: 'Northside Auto Group', spend: '$42,880', conv: 68, roas: '5.2x', cpl: '$184', spark: 11, status: 'Active', delta: 4.2 },
  { name: 'Bloom & Vine Florist', spend: '$3,940', conv: 112, roas: '4.1x', cpl: '$12', spark: 5, status: 'Active', delta: 18.3 },
  { name: 'Kettle & Crumb Bakery', spend: '$1,210', conv: 28, roas: '1.9x', cpl: '$22', spark: 2, status: 'Paused', delta: -22.0 },
  { name: 'Harbor Legal Partners', spend: '$9,620', conv: 41, roas: '6.8x', cpl: '$96', spark: 9, status: 'Active', delta: 8.7 },
  { name: 'Pinecrest Family Dentistry', spend: '$4,180', conv: 29, roas: '2.1x', cpl: '$62', spark: 4, status: 'Active', delta: -2.4 },
  { name: 'Lumen Eyecare', spend: '$7,340', conv: 71, roas: '3.4x', cpl: '$38', spark: 6, status: 'Active', delta: 6.0 },
];

export const CAMPAIGNS: Campaign[] = [
  { name: 'Leads | ASO | Group Events | April 2025', strategy: 'Lead Gen', spend: '$4,820', conv: 42, roas: '4.2x', cpl: '$38', status: 'Active', id: 'cmp_82910' },
  { name: 'Add to Cart | Birthdays | 2025', strategy: 'ATC', spend: '$2,104', conv: 88, roas: '2.8x', cpl: '$14', status: 'Active', id: 'cmp_82911' },
  { name: 'Purchase | Spring Sale | 2025', strategy: 'Purchase', spend: '$8,612', conv: 121, roas: '6.1x', cpl: '$22', status: 'Active', id: 'cmp_82912' },
  { name: 'Traffic | Local SEO Boost | Q2', strategy: 'Traffic', spend: '$960', conv: 14, roas: '1.4x', cpl: '$61', status: 'Paused', id: 'cmp_82913' },
  { name: 'Video | Brand Awareness | April', strategy: 'Video', spend: '$1,480', conv: 6, roas: '0.8x', cpl: '$220', status: 'Active', id: 'cmp_82914' },
  { name: 'Leads | New Patient Forms | April', strategy: 'Lead Gen', spend: '$3,220', conv: 48, roas: '3.6x', cpl: '$44', status: 'Active', id: 'cmp_82915' },
];

export const POSTS_WEEK: WeekPostsDay[] = [
  { day: 0, list: [{ status: 'Published', fmt: 'Post', client: 'Acme Dental' }] },
  { day: 1, list: [{ status: 'Scheduled', fmt: 'Reel', client: 'Seaside Yoga' }, { status: 'Draft', fmt: 'Post', client: 'Bloom & Vine' }] },
  { day: 2, list: [{ status: 'Approved', fmt: 'Carousel', client: 'Northside Ford' }] },
  { day: 3, list: [{ status: 'Scheduled', fmt: 'Post', client: 'Lumen Eyecare' }, { status: 'Scheduled', fmt: 'Post', client: 'Acme Dental' }] },
  { day: 4, list: [{ status: 'Error', fmt: 'Reel', client: 'Kettle & Crumb' }] },
  { day: 5, list: [{ status: 'Draft', fmt: 'Post', client: 'Harbor Legal' }] },
  { day: 6, list: [] },
];

export const URGENT: UrgentIssue[] = [
  {
    sev: 'red',
    title: 'CPL 3.2× higher than account avg on Acme Dental → Leads | ASO | April',
    body: 'This campaign has spent $4,820 with 12 conversions this week — budget pacing will exhaust daily cap by Friday. Consider pausing the underperforming ad set "ASO — Broad".',
  },
  {
    sev: 'amber',
    title: 'Bloom & Vine CTR dropped 28% week-over-week',
    body: 'Creative fatigue likely — all 3 active ads are >14 days old. Generate 2–3 new variations grounded in the top performer from March.',
  },
  {
    sev: 'amber',
    title: 'Northside Kia has no conversions in last 7 days',
    body: 'Tracking pixel may be misfiring. 4 campaigns active, $8,420 spend, zero reported conversions. Verify META pixel events.',
  },
];

export const POSTS_QUEUE: QueuedPost[] = [
  { thumb: 1, client: 'Acme Dental', chan: ['fb', 'ig'], when: 'Apr 22 · 09:30', fmt: 'Reel', status: 'Queued' },
  { thumb: 2, client: 'Seaside Yoga', chan: ['ig'], when: 'Apr 22 · 14:00', fmt: 'Post', status: 'Queued' },
  { thumb: 3, client: 'Bloom & Vine', chan: ['fb', 'ig'], when: 'Apr 22 · 17:15', fmt: 'Carousel', status: 'Publishing' },
  { thumb: 4, client: 'Lumen Eyecare', chan: ['fb'], when: 'Apr 22 · 08:00', fmt: 'Post', status: 'Published' },
  { thumb: 5, client: 'Northside Ford', chan: ['fb', 'ig'], when: 'Apr 21 · 11:00', fmt: 'Post', status: 'Published' },
  { thumb: 6, client: 'Kettle & Crumb', chan: ['ig'], when: 'Apr 21 · 16:30', fmt: 'Reel', status: 'Failed' },
];

/**
 * Per-client aggregated stats shown on the Clients grid cards.
 * In production these will be computed aggregates (sum of spend MTD,
 * count of active campaigns, avg posts per week) — keep keyed by
 * client id so we don't rely on array-index alignment with CLIENTS.
 */
export const CLIENT_CARD_STATS: Record<string, ClientCardStats> = {
  acme:      { mtdSpend: '$18,420', activeCampaigns: 6, postsPerWeek: 4 },
  seaside:   { mtdSpend: '$6,210',  activeCampaigns: 3, postsPerWeek: 3 },
  northside: { mtdSpend: '$42,880', activeCampaigns: 9, postsPerWeek: 2 },
  bloom:     { mtdSpend: '$3,940',  activeCampaigns: 2, postsPerWeek: 5 },
  kettle:    { mtdSpend: '$1,210',  activeCampaigns: 1, postsPerWeek: 1 },
  harbor:    { mtdSpend: '$9,620',  activeCampaigns: 4, postsPerWeek: 2 },
  pine:      { mtdSpend: '$4,180',  activeCampaigns: 2, postsPerWeek: 2 },
  lumen:     { mtdSpend: '$7,340',  activeCampaigns: 3, postsPerWeek: 3 },
  summit:    { mtdSpend: '$2,910',  activeCampaigns: 2, postsPerWeek: 2 },
};

/**
 * Per-client detail KPIs shown in the Client Detail > Overview tab.
 * Deltas and seeds are illustrative; in production these will be the
 * result of metric aggregations per time window.
 */
export const CLIENT_KPIS: Record<string, ClientKpis> = {
  acme: {
    spend:       { value: '$18,420', delta: 12.4, seed: 3 },
    conversions: { value: '142',     delta: 8.1,  seed: 5 },
    roas:        { value: '3.8×',    delta: 4.0,  seed: 2 },
    cpl:         { value: '$48',     delta: -2.2, seed: 9 },
  },
  seaside: {
    spend:       { value: '$6,210',  delta: -6.1, seed: 7 },
    conversions: { value: '58',      delta: -3.4, seed: 4 },
    roas:        { value: '2.4×',    delta: -1.2, seed: 6 },
    cpl:         { value: '$31',     delta: 2.1,  seed: 8 },
  },
  northside: {
    spend:       { value: '$42,880', delta: 4.2,  seed: 11 },
    conversions: { value: '68',      delta: 2.4,  seed: 3 },
    roas:        { value: '5.2×',    delta: 1.8,  seed: 5 },
    cpl:         { value: '$184',    delta: -0.6, seed: 7 },
  },
  bloom: {
    spend:       { value: '$3,940',  delta: 18.3, seed: 5 },
    conversions: { value: '112',     delta: 22.4, seed: 2 },
    roas:        { value: '4.1×',    delta: 6.0,  seed: 4 },
    cpl:         { value: '$12',     delta: -8.4, seed: 6 },
  },
  kettle: {
    spend:       { value: '$1,210',  delta: -22.0, seed: 2 },
    conversions: { value: '28',      delta: -18.1, seed: 8 },
    roas:        { value: '1.9×',    delta: -4.2,  seed: 3 },
    cpl:         { value: '$22',     delta: 6.1,   seed: 5 },
  },
  harbor: {
    spend:       { value: '$9,620',  delta: 8.7,  seed: 9 },
    conversions: { value: '41',      delta: 4.2,  seed: 6 },
    roas:        { value: '6.8×',    delta: 2.1,  seed: 4 },
    cpl:         { value: '$96',     delta: -1.8, seed: 7 },
  },
  pine: {
    spend:       { value: '$4,180',  delta: -2.4, seed: 4 },
    conversions: { value: '29',      delta: -1.2, seed: 5 },
    roas:        { value: '2.1×',    delta: 0.4,  seed: 3 },
    cpl:         { value: '$62',     delta: 1.1,  seed: 6 },
  },
  lumen: {
    spend:       { value: '$7,340',  delta: 6.0,  seed: 6 },
    conversions: { value: '71',      delta: 3.8,  seed: 3 },
    roas:        { value: '3.4×',    delta: 1.4,  seed: 5 },
    cpl:         { value: '$38',     delta: -2.0, seed: 7 },
  },
  summit: {
    spend:       { value: '$2,910',  delta: 1.2,  seed: 8 },
    conversions: { value: '18',      delta: 2.8,  seed: 2 },
    roas:        { value: '2.8×',    delta: 0.6,  seed: 9 },
    cpl:         { value: '$162',    delta: -1.4, seed: 4 },
  },
};

/**
 * Editable brand profiles by client id. Absent entries mean the client
 * hasn't completed brand onboarding yet — the Brand tab renders an
 * empty state in that case. Logo upload goes through object storage
 * (Supabase Storage later), so logoUrl starts null.
 */
export const BRAND_PROFILES: Record<string, BrandProfile> = {
  acme: {
    description:
      'Full-service family dental practice serving 3 neighborhoods. Specializes in Invisalign, same-day crowns, and pediatric dentistry. Founded 2008.',
    voice: 'Warm, reassuring, professionally confident. Avoid clinical jargon. Use first names.',
    dos: [
      'Lead with patient outcomes',
      'Mention same-day availability',
      'Photos of real staff, real patients (with consent)',
    ],
    donts: [
      'No before/after without disclaimer',
      'No pricing in ads',
      'No stock photos of teeth close-ups',
    ],
    logoUrl: null,
  },
  seaside: {
    description:
      'Boutique yoga studio and wellness space on the waterfront. Classes for all levels, private sessions, teacher training, monthly community retreats.',
    voice: 'Grounded, inviting, not woo-y. Speak to real people returning to their bodies — not influencers.',
    dos: [
      'Name the teacher leading the class',
      'Show varied body types and ages',
      'Reference the coastline, the light, the season',
    ],
    donts: [
      'No "perfect pose" shots',
      'No medical/health claims',
      'No stock imagery — always real studio photography',
    ],
    logoUrl: null,
  },
  bloom: {
    description:
      'Independent florist and plant shop. Weekly subscriptions, custom events, and same-day delivery within 5 miles. Focused on local and seasonal sourcing.',
    voice: 'Quietly enthusiastic. Short sentences. Let the flowers do the talking.',
    dos: [
      'Name every variety shown',
      'Cite the grower when known',
      'Lead with one hero stem per post',
    ],
    donts: [
      'No filters that distort flower colors',
      'No clichéd "Valentines / Mother’s Day" copy',
      'Never promise flowers we can’t source locally',
    ],
    logoUrl: null,
  },
};

/**
 * META ad account IDs by client id. Absent for clients that haven't
 * connected META yet.
 */
export const META_ACCOUNTS: Record<string, string> = {
  acme: 'act_139204882',
  seaside: 'act_140118723',
  northside: 'act_137904412',
  bloom: 'act_141220077',
  harbor: 'act_138991045',
  lumen: 'act_142018330',
};

/**
 * Uploaded brand assets keyed by client. The 8 acme rows match the
 * wireframe; a handful of seaside + bloom entries are seeded so those
 * clients' Assets tab also renders meaningfully. `analysisSummary` is
 * populated only when analysisStatus === 'Analyzed' *and* we have an
 * AI writeup — other analyzed assets have the label but no writeup yet.
 */
export const ASSETS: Asset[] = [
  { id: 'ast_acme_01', clientId: 'acme',    name: 'acme-primary-logo.svg',        kind: 'Logo',  analysisStatus: 'Analyzed', sizeLabel: '4 KB',    dateLabel: 'Mar 12', analysisSummary: null },
  { id: 'ast_acme_02', clientId: 'acme',    name: 'family-saturdays-hero.jpg',    kind: 'Photo', analysisStatus: 'Analyzed', sizeLabel: '1.4 MB',  dateLabel: 'Apr 02',
    analysisSummary:
      'Subjects: 2 adults, 2 children, outdoor setting, warm daylight. Detected elements: picnic blanket, laughter. Matches brand voice (warm, family-first). Suggested tags: #family #weekend #lifestyle.' },
  { id: 'ast_acme_03', clientId: 'acme',    name: 'dr-patel-headshot.jpg',        kind: 'Photo', analysisStatus: 'Analyzed', sizeLabel: '2.1 MB',  dateLabel: 'Feb 28', analysisSummary: null },
  { id: 'ast_acme_04', clientId: 'acme',    name: 'invisalign-before-after.jpg',  kind: 'Photo', analysisStatus: 'Pending',  sizeLabel: '3.8 MB',  dateLabel: 'Apr 18', analysisSummary: null },
  { id: 'ast_acme_05', clientId: 'acme',    name: 'reception-360.mp4',            kind: 'Video', analysisStatus: 'Pending',  sizeLabel: '14.2 MB', dateLabel: 'Apr 14', analysisSummary: null },
  { id: 'ast_acme_06', clientId: 'acme',    name: 'brand-guidelines-2025.pdf',    kind: 'Doc',   analysisStatus: 'Analyzed', sizeLabel: '840 KB',  dateLabel: 'Jan 08', analysisSummary: null },
  { id: 'ast_acme_07', clientId: 'acme',    name: 'crown-procedure-demo.mp4',     kind: 'Video', analysisStatus: 'Failed',   sizeLabel: '22.1 MB', dateLabel: 'Apr 11', analysisSummary: null },
  { id: 'ast_acme_08', clientId: 'acme',    name: 'staff-photo-group.jpg',        kind: 'Photo', analysisStatus: 'Analyzed', sizeLabel: '2.8 MB',  dateLabel: 'Mar 22', analysisSummary: null },

  { id: 'ast_sea_01',  clientId: 'seaside', name: 'seaside-wordmark.svg',         kind: 'Logo',  analysisStatus: 'Analyzed', sizeLabel: '3 KB',    dateLabel: 'Feb 10', analysisSummary: null },
  { id: 'ast_sea_02',  clientId: 'seaside', name: 'morning-class-sunrise.jpg',    kind: 'Photo', analysisStatus: 'Analyzed', sizeLabel: '1.9 MB',  dateLabel: 'Mar 28', analysisSummary: null },
  { id: 'ast_sea_03',  clientId: 'seaside', name: 'teacher-training-promo.mp4',   kind: 'Video', analysisStatus: 'Pending',  sizeLabel: '31.4 MB', dateLabel: 'Apr 16', analysisSummary: null },

  { id: 'ast_blm_01',  clientId: 'bloom',   name: 'bloom-vine-mark.svg',          kind: 'Logo',  analysisStatus: 'Analyzed', sizeLabel: '2 KB',    dateLabel: 'Jan 22', analysisSummary: null },
  { id: 'ast_blm_02',  clientId: 'bloom',   name: 'peony-bundle-april.jpg',       kind: 'Photo', analysisStatus: 'Analyzed', sizeLabel: '1.2 MB',  dateLabel: 'Apr 09', analysisSummary: null },

  { id: 'ast_lum_01',  clientId: 'lumen',   name: 'lumen-monogram.svg',           kind: 'Logo',  analysisStatus: 'Analyzed', sizeLabel: '3 KB',    dateLabel: 'Feb 04', analysisSummary: null },
  { id: 'ast_lum_02',  clientId: 'lumen',   name: 'frame-wall-hero.jpg',          kind: 'Photo', analysisStatus: 'Analyzed', sizeLabel: '2.4 MB',  dateLabel: 'Mar 18', analysisSummary: null },

  { id: 'ast_har_01',  clientId: 'harbor',  name: 'harbor-wordmark.svg',          kind: 'Logo',  analysisStatus: 'Analyzed', sizeLabel: '4 KB',    dateLabel: 'Jan 15', analysisSummary: null },
  { id: 'ast_har_02',  clientId: 'harbor',  name: 'managing-partners.jpg',        kind: 'Photo', analysisStatus: 'Pending',  sizeLabel: '3.1 MB',  dateLabel: 'Apr 06', analysisSummary: null },

  { id: 'ast_pin_01',  clientId: 'pine',    name: 'pinecrest-primary.svg',        kind: 'Logo',  analysisStatus: 'Pending',  sizeLabel: '5 KB',    dateLabel: 'Apr 15', analysisSummary: null },
  { id: 'ast_pin_02',  clientId: 'pine',    name: 'pediatric-waiting-room.jpg',   kind: 'Photo', analysisStatus: 'Analyzed', sizeLabel: '1.8 MB',  dateLabel: 'Mar 29', analysisSummary: null },
];

/**
 * Scraped domains per client. One row per connected website. Page
 * counts are denormalized from SCRAPED_PAGES for card-display speed.
 */
export const SCRAPED_DOMAINS: ScrapedDomain[] = [
  { id: 'dom_acme_01',  clientId: 'acme',      domain: 'acmedental.com',        health: 'Healthy',  sitemapStatus: 'Discovered', pageCount: 24,  lastScrapedLabel: '2d ago' },
  { id: 'dom_sea_01',   clientId: 'seaside',   domain: 'seasideyoga.com',       health: 'Healthy',  sitemapStatus: 'Discovered', pageCount: 12,  lastScrapedLabel: '4d ago' },
  { id: 'dom_nsa_01',   clientId: 'northside', domain: 'northsideautogroup.com', health: 'Stale',   sitemapStatus: 'Partial',    pageCount: 142, lastScrapedLabel: '9d ago' },
  { id: 'dom_blm_01',   clientId: 'bloom',     domain: 'bloomandvine.co',       health: 'Healthy',  sitemapStatus: 'Discovered', pageCount: 86,  lastScrapedLabel: '1d ago' },
  { id: 'dom_ktl_01',   clientId: 'kettle',    domain: 'kettleandcrumb.cafe',   health: 'Error',    sitemapStatus: 'Failed',     pageCount: 8,   lastScrapedLabel: '—' },
];

/**
 * Individual scraped pages. Path/title/words populated per the wireframe
 * for acme; lightly seeded for seaside + bloom. In production these rows
 * come from a crawler writing to the scraped_pages table.
 */
export const SCRAPED_PAGES: ScrapedPage[] = [
  { id: 'pg_acme_01', clientId: 'acme', domainId: 'dom_acme_01', path: '/',                      title: 'Acme Dental — Family dentistry in 3 neighborhoods', words: 742,  lastScrapedLabel: '2d ago', analysisStatus: 'Done' },
  { id: 'pg_acme_02', clientId: 'acme', domainId: 'dom_acme_01', path: '/about',                 title: 'Our story',                                          words: 612,  lastScrapedLabel: '2d ago', analysisStatus: 'Done' },
  { id: 'pg_acme_03', clientId: 'acme', domainId: 'dom_acme_01', path: '/services',              title: 'Services overview',                                  words: 920,  lastScrapedLabel: '2d ago', analysisStatus: 'Done' },
  { id: 'pg_acme_04', clientId: 'acme', domainId: 'dom_acme_01', path: '/services/invisalign',   title: 'Invisalign — clear aligners',                        words: 1280, lastScrapedLabel: '2d ago', analysisStatus: 'Done' },
  { id: 'pg_acme_05', clientId: 'acme', domainId: 'dom_acme_01', path: '/services/crowns',       title: 'Same-day crowns',                                    words: 840,  lastScrapedLabel: '2d ago', analysisStatus: 'Done' },
  { id: 'pg_acme_06', clientId: 'acme', domainId: 'dom_acme_01', path: '/locations/downtown',    title: 'Downtown location',                                  words: 410,  lastScrapedLabel: '2d ago', analysisStatus: 'Done' },
  { id: 'pg_acme_07', clientId: 'acme', domainId: 'dom_acme_01', path: '/blog/saturday-hours',   title: 'Why we added Saturday hours',                        words: 680,  lastScrapedLabel: '9d ago', analysisStatus: 'Stale' },
  { id: 'pg_acme_08', clientId: 'acme', domainId: 'dom_acme_01', path: '/contact',               title: 'Contact + directions',                               words: 240,  lastScrapedLabel: '2d ago', analysisStatus: 'Done' },

  { id: 'pg_sea_01',  clientId: 'seaside', domainId: 'dom_sea_01', path: '/',           title: 'Seaside Yoga — classes on the coast',        words: 520, lastScrapedLabel: '5d ago', analysisStatus: 'Done' },
  { id: 'pg_sea_02',  clientId: 'seaside', domainId: 'dom_sea_01', path: '/schedule',   title: 'Weekly schedule',                            words: 310, lastScrapedLabel: '5d ago', analysisStatus: 'Done' },
  { id: 'pg_sea_03',  clientId: 'seaside', domainId: 'dom_sea_01', path: '/teachers',   title: 'Meet the teachers',                          words: 640, lastScrapedLabel: '5d ago', analysisStatus: 'Done' },

  { id: 'pg_blm_01',  clientId: 'bloom',   domainId: 'dom_blm_01', path: '/',           title: 'Bloom & Vine — local florist',               words: 380, lastScrapedLabel: '12h ago', analysisStatus: 'Done' },
  { id: 'pg_blm_02',  clientId: 'bloom',   domainId: 'dom_blm_01', path: '/shop',       title: 'Shop flowers + plants',                      words: 210, lastScrapedLabel: '12h ago', analysisStatus: 'Pending' },
  { id: 'pg_blm_03',  clientId: 'bloom',   domainId: 'dom_blm_01', path: '/subscriptions', title: 'Weekly subscriptions',                    words: 260, lastScrapedLabel: '12h ago', analysisStatus: 'Failed' },
];

/**
 * Connected META ad accounts per client. Acme has 3 active + 1 hard-
 * excluded (matching the wireframe) with one in-progress refresh to
 * exercise the progress banner. Other clients get a single active row
 * so the tab isn't empty. Excluded metadata lives inline — that's how
 * the detail card reads back the "why was this excluded" story.
 */
export const AD_ACCOUNTS: AdAccount[] = [
  { id: 'acc_acme_01', clientId: 'acme', name: 'Acme Dental — Downtown',           accountId: 'act_139204882', currency: 'USD', status: 'Active',     activeCampaigns: 6, mtdSpend: '$8,210', lastRefreshLabel: '8m ago',      excludedAt: null, excludedBy: null, excludedReason: null },
  { id: 'acc_acme_02', clientId: 'acme', name: 'Acme Dental — Midtown',            accountId: 'act_139204883', currency: 'USD', status: 'Active',     activeCampaigns: 4, mtdSpend: '$6,420', lastRefreshLabel: '12m ago',     excludedAt: null, excludedBy: null, excludedReason: null },
  { id: 'acc_acme_03', clientId: 'acme', name: 'Acme Dental — Westside',           accountId: 'act_139204884', currency: 'USD', status: 'Refreshing', activeCampaigns: 3, mtdSpend: '$3,790', lastRefreshLabel: 'in progress', excludedAt: null, excludedBy: null, excludedReason: null },
  { id: 'acc_acme_04', clientId: 'acme', name: 'Acme Dental — Legacy (archived)',  accountId: 'act_118220310', currency: 'USD', status: 'Excluded',   activeCampaigns: 0, mtdSpend: '—',      lastRefreshLabel: '—',
    excludedAt: 'Jan 03', excludedBy: 'jordan@redwood.co', excludedReason: 'archived account with historical test spend that skewed totals' },

  { id: 'acc_sea_01',    clientId: 'seaside',   name: 'Seaside Yoga',              accountId: 'act_140118723', currency: 'USD', status: 'Active',     activeCampaigns: 3, mtdSpend: '$6,210', lastRefreshLabel: '22m ago',     excludedAt: null, excludedBy: null, excludedReason: null },
  { id: 'acc_nsa_01',    clientId: 'northside', name: 'Northside Ford',            accountId: 'act_137904412', currency: 'USD', status: 'Active',     activeCampaigns: 5, mtdSpend: '$24,120', lastRefreshLabel: '4m ago',     excludedAt: null, excludedBy: null, excludedReason: null },
  { id: 'acc_nsa_02',    clientId: 'northside', name: 'Northside Kia',             accountId: 'act_137904413', currency: 'USD', status: 'Active',     activeCampaigns: 4, mtdSpend: '$18,760', lastRefreshLabel: '4m ago',     excludedAt: null, excludedBy: null, excludedReason: null },
  { id: 'acc_blm_01',    clientId: 'bloom',     name: 'Bloom & Vine Florist',      accountId: 'act_141220077', currency: 'USD', status: 'Active',     activeCampaigns: 2, mtdSpend: '$3,940', lastRefreshLabel: '1h ago',      excludedAt: null, excludedBy: null, excludedReason: null },
  { id: 'acc_har_01',    clientId: 'harbor',    name: 'Harbor Legal Partners',     accountId: 'act_138991045', currency: 'USD', status: 'Active',     activeCampaigns: 4, mtdSpend: '$9,620', lastRefreshLabel: '30m ago',     excludedAt: null, excludedBy: null, excludedReason: null },
  { id: 'acc_lum_01',    clientId: 'lumen',     name: 'Lumen Eyecare',             accountId: 'act_142018330', currency: 'USD', status: 'Active',     activeCampaigns: 3, mtdSpend: '$7,340', lastRefreshLabel: '15m ago',     excludedAt: null, excludedBy: null, excludedReason: null },
];

/**
 * Ad Performance hierarchy tree shown in the left rail. Flat array of
 * nodes with a depth (lvl) — renders hierarchical via indentation. The
 * currently-selected campaign defaults to cmp_82910 (acme's ASO campaign).
 * Shape mirrors what a recursive Supabase query would flatten into.
 */
export const AD_PERF_TREE: AdPerfTreeNode[] = [
  { id: 'n_all',                   lvl: 0, label: 'All clients',                               spend: '$94,842', icon: 'home' },
  { id: 'n_acme',                  lvl: 1, label: 'Acme Dental',                               spend: '$18,420', icon: 'users' },
  { id: 'n_acme_act_139204882',    lvl: 2, label: 'act_139204882',                             spend: '$18,420', icon: 'chart', mono: true },
  { id: 'n_cmp_82910',             lvl: 3, label: 'Leads | ASO | Group Events | April 2025',   spend: '$4,820',  icon: 'bolt',  campaignId: 'cmp_82910' },
  { id: 'n_adset_443021',          lvl: 4, label: 'ASO — Broad',                               spend: '$2,410',  campaignId: 'cmp_82910' },
  { id: 'n_adset_443022',          lvl: 4, label: 'ASO — Lookalike 1%',                        spend: '$1,680',  campaignId: 'cmp_82910' },
  { id: 'n_adset_443023',          lvl: 4, label: 'ASO — Retargeting',                         spend: '$730',    campaignId: 'cmp_82910' },
  { id: 'n_cmp_82911',             lvl: 3, label: 'Add to Cart | Birthdays | 2025',            spend: '$2,104',  campaignId: 'cmp_82911' },
  { id: 'n_cmp_82912',             lvl: 3, label: 'Purchase | Spring Sale | 2025',             spend: '$8,612',  campaignId: 'cmp_82912' },
  { id: 'n_seaside',               lvl: 1, label: 'Seaside Yoga',                              spend: '$6,210',  icon: 'users' },
  { id: 'n_northside',             lvl: 1, label: 'Northside Auto Group',                      spend: '$42,880', icon: 'users' },
];

/**
 * Per-campaign detail shown on the right when a campaign is selected.
 * Only cmp_82910 is fully populated (matches the wireframe); other
 * campaigns fall through to a "no data yet" state. Deltas of 0 signal
 * non-numeric metrics (Quality / Engagement) — the view renders a
 * five-segment bar instead of a sparkline for those.
 */
export const CAMPAIGN_DETAILS: Record<string, CampaignDetail> = {
  cmp_82910: {
    id: 'cmp_82910',
    clientId: 'acme',
    name: 'Leads | ASO | Group Events | April 2025',
    strategy: 'Lead Gen',
    status: 'Active',
    accountId: 'act_139204882',
    clientName: 'Acme Dental',
    lastRefreshLabel: '8m ago',
    kpis: [
      { label: 'Spend',       value: '$4,820',    delta: 12.4, seed: 1  },
      { label: 'Impressions', value: '284K',      delta: 6.2,  seed: 2  },
      { label: 'Reach',       value: '192K',      delta: 4.8,  seed: 3  },
      { label: 'Clicks',      value: '3,210',     delta: -3.1, seed: 4  },
      { label: 'CTR',         value: '1.13%',     delta: -8.7, seed: 5  },
      { label: 'CPC',         value: '$1.50',     delta: 2.1,  seed: 6  },
      { label: 'CPM',         value: '$16.97',    delta: 5.4,  seed: 7  },
      { label: 'Conversions', value: '42',        delta: 18.3, seed: 8  },
      { label: 'Cost/Conv',   value: '$115',      delta: -4.8, seed: 9  },
      { label: 'ROAS',        value: '4.2×',      delta: 11.2, seed: 10 },
      { label: 'Quality',     value: 'Avg',       delta: 0,    seed: 11 },
      { label: 'Engagement',  value: 'Above avg', delta: 0,    seed: 12 },
    ],
    adSets: [
      { id: 'adset_443021', campaignId: 'cmp_82910', name: 'ASO — Broad',          spend: '$2,410', conv: 0,  cpl: '—',   ctr: '0.82%', cplPct: 0,  sparkSeed: 44, trendUp: false, status: 'Active' },
      { id: 'adset_443022', campaignId: 'cmp_82910', name: 'ASO — Lookalike 1%',   spend: '$1,680', conv: 18, cpl: '$93', ctr: '1.42%', cplPct: 78, sparkSeed: 45, trendUp: true,  status: 'Active' },
      { id: 'adset_443023', campaignId: 'cmp_82910', name: 'ASO — Retargeting',    spend: '$730',   conv: 24, cpl: '$30', ctr: '2.11%', cplPct: 28, sparkSeed: 46, trendUp: true,  status: 'Active' },
    ],
    insights: [
      {
        priority: 'High priority',
        accent: 'red',
        title: 'ASO — Broad is burning budget with no conversions',
        body: '$2,410 spent over 6 days. 0 conversions vs. 18 for ASO — Lookalike 1%. Recommend pausing Broad, reallocating to Lookalike.',
        actions: [
          { label: 'Pause ad set →', style: 'ai' },
          { label: 'Create variant in Ad Studio →', style: 'default' },
        ],
      },
      {
        priority: 'Medium',
        accent: 'amber',
        title: 'Creative fatigue likely on 2 of 4 ads',
        body: 'CTR declined 28% over 14 days. Top performer from March ("Family Saturdays") had 4.1% CTR — generate 3 new variants grounded in that angle.',
        actions: [],
      },
    ],
  },
};

/**
 * Ad Studio brief seeds per client. Only acme is populated — the wireframe
 * Ad Studio was written around Acme Dental's Lead Gen campaign. Other
 * clients fall through to a "no brief yet" stub so the view still loads.
 * In production, these fields come from a Claude generation call grounded
 * in the client's brand profile + top 90-day performers.
 */
export const AD_BRIEFS: Record<string, AdBrief> = {
  acme: {
    clientId: 'acme',
    subtitle: 'AI-grounded ad creation for Acme Dental · Lead Gen · FB + IG',
    promptDraft:
      'Warm, family-first. Emphasize same-day crowns and Saturday availability. Photos of real staff.',
    ideas: [
      { title: 'Family Saturdays',       body: 'Lean into weekend convenience for working parents.' },
      { title: 'Same-day, same-chair',   body: 'Emphasize same-day crown tech as a time-saver.' },
      { title: 'First-visit comfort',    body: 'Warm pediatric angle for new patients and nervous adults.' },
      { title: 'Insurance made easy',    body: 'Lead with "we accept most plans — no surprises".' },
      { title: 'Meet Dr. Patel',         body: 'Staff-led trust angle, real photos, human voice.' },
      { title: 'Neighborhood office',    body: 'Local-first — Portland parents, 10 min from anywhere.' },
    ],
    directions: [
      { title: 'Family Saturdays',       body: 'Lean into weekend convenience for working parents.', selected: true },
      { title: 'Same-day, same-chair',   body: 'Emphasize same-day crown technology as a time-saver.' },
      { title: 'First-visit comfort',    body: 'Warm pediatric angle for new patients and nervous adults.' },
    ],
    headlines: [
      'Saturday dental care for busy families',
      'Same-day crowns. No second visit.',
      'Your weekend dentist, open 9–3 Saturdays',
      'Book a Saturday slot — insurance welcome',
    ],
    images: [
      { kind: 'photo', headline: 'Saturdays at Acme',   seed: 91 },
      { kind: 'offer', headline: 'Same-day crowns',     seed: 98 },
      { kind: 'photo', headline: 'Meet Dr. Patel',      seed: 105 },
      { kind: 'bg',    headline: 'Book this Saturday',  seed: 112 },
    ],
    reference: {
      fileName: 'staff-saturday.jpg',
      sizeLabel: '1.8 MB',
      dims: '2400×2400',
      analysis: '"3 people in clinic setting, warm lighting"',
    },
  },
};

/**
 * Workspace-level Brand Intelligence stats — aggregates across every
 * client in the current workspace. In production these are derived
 * from DB counts; for now they match the wireframe display text.
 */
export const BRAND_INTEL_STATS: BrandIntelligenceStats = {
  domains: { count: 12, pagesIndexed: 284 },
  competitors: { tracked: 8, newPagesThisWeek: 3 },
  rules: { total: 47, crossClient: 12 },
  assets: { total: 184, aiAnalyzed: 32 },
};

/**
 * Claude's cross-workspace takeaway shown under the hero stats. In
 * production this is a generated summary of the latest Brand
 * Intelligence scan results.
 */
export const BRAND_TAKEAWAY: BrandTakeaway = {
  body:
    'Across your 8 competitors, 3 themes dominate: "same-day service" (7 of 8), "insurance transparency" (5 of 8), and "family pricing" (4 of 8). Only 1 competitor talks about sustainability — potential positioning gap for Acme Dental.',
};

/**
 * Brand comparison tables per client — what the Brand Intelligence
 * Compare tab renders. Acme compares against its two closest tracked
 * competitors (brightsmile.co, smileworks.com). Cells carry a
 * discriminator so the row renderer can branch into swatches / cadence
 * / text. `gap: true` on a cell flags where the client is behind and
 * shows the "Draft ad to close gap" affordance.
 */
export const BRAND_COMPARISONS: Record<string, BrandComparison> = {
  acme: {
    clientId: 'acme',
    selfName: 'Acme Dental',
    competitorDomains: ['brightsmile.co', 'smileworks.com'],
    rows: [
      {
        dimension: 'Brand voice',
        cells: [
          { type: 'text', value: 'Warm, family-first' },
          { type: 'text', value: 'Clinical, reassuring' },
          { type: 'text', value: 'Premium, tech-forward' },
        ],
      },
      {
        dimension: 'Positioning',
        cells: [
          { type: 'text', value: 'Neighborhood dentist' },
          { type: 'text', value: 'Family value' },
          { type: 'text', value: 'Luxury concierge', gap: true },
        ],
      },
      {
        dimension: 'Primary CTA',
        cells: [
          { type: 'text', value: 'Book online' },
          { type: 'text', value: 'Get a free quote' },
          { type: 'text', value: 'Schedule consultation' },
        ],
      },
      {
        dimension: 'Visual palette',
        cells: [
          { type: 'palette', colors: ['#2a5f8d', '#f4e3b2', '#0e8a80'] },
          { type: 'palette', colors: ['#b83f3f', '#f9f5ee', '#2b2b2b'] },
          { type: 'palette', colors: ['#1a1a1a', '#c9a961', '#ffffff'] },
        ],
      },
      {
        dimension: 'Content cadence',
        cells: [
          { type: 'cadence', seed: 4 },
          { type: 'cadence', seed: 3 },
          { type: 'cadence', seed: 8, gap: true },
        ],
      },
      {
        dimension: 'Channel mix',
        cells: [
          { type: 'text', value: 'FB 60% · IG 40%' },
          { type: 'text', value: 'FB 80% · IG 20%' },
          { type: 'text', value: 'IG 70% · FB 20% · TikTok 10%' },
        ],
      },
    ],
  },
};

/**
 * Positioning-gap opportunities per client. Each row is a theme where
 * the client could differentiate because competitors are under-indexing
 * on it. Confidence is Claude's score on how strongly the gap holds up
 * given the scraped evidence.
 */
export const GAP_ANGLES: GapAngle[] = [
  { id: 'gap_acme_01', clientId: 'acme', title: 'Sustainability / eco-friendly practice',          confidence: 82, evidence: 'Only 1 of 8 competitors mentions eco-materials. Acme uses BPA-free composites.' },
  { id: 'gap_acme_02', clientId: 'acme', title: 'Weekend-only specialty clinic',                   confidence: 71, evidence: '3 of 8 competitors mention Saturday hours, but none position weekends as the core offering.' },
  { id: 'gap_acme_03', clientId: 'acme', title: 'Transparent upfront pricing for common procedures', confidence: 64, evidence: '2 competitors list "starting at" prices; none show full menu. Acme could break category norms here.' },
  { id: 'gap_acme_04', clientId: 'acme', title: 'Bilingual care emphasis',                         confidence: 58, evidence: 'No competitor markets in Spanish despite 34% of local demo. Acme has a bilingual hygienist.' },
];

/**
 * Workspace-level brand rules Claude uses to validate generated content
 * before it hits the approval queue. Four categories: dos / donts /
 * tone / visual. clientId is null for cross-client rules (all entries
 * here are cross-client; per-client overrides will live alongside).
 */
export const BRAND_RULES: BrandRule[] = [
  // Do's — across all clients
  { id: 'rule_do_01',   category: 'dos',    text: 'Lead with patient / customer outcome',         clientId: null },
  { id: 'rule_do_02',   category: 'dos',    text: 'Use real staff photos when available',         clientId: null },
  { id: 'rule_do_03',   category: 'dos',    text: 'Include location-specific CTAs',               clientId: null },
  { id: 'rule_do_04',   category: 'dos',    text: 'Mention insurance / financing where relevant', clientId: null },

  // Don'ts — across all clients
  { id: 'rule_dont_01', category: 'donts',  text: 'No pricing in paid ads without disclaimer',    clientId: null },
  { id: 'rule_dont_02', category: 'donts',  text: 'No stock medical imagery',                     clientId: null },
  { id: 'rule_dont_03', category: 'donts',  text: 'No before/after without consent',              clientId: null },
  { id: 'rule_dont_04', category: 'donts',  text: 'No comparative superlatives ("best in town")', clientId: null },

  // Tone
  { id: 'rule_tone_01', category: 'tone',   text: 'Warm over clinical',                           clientId: null },
  { id: 'rule_tone_02', category: 'tone',   text: 'First names over titles',                      clientId: null },
  { id: 'rule_tone_03', category: 'tone',   text: 'Active voice',                                 clientId: null },
  { id: 'rule_tone_04', category: 'tone',   text: 'Reading level: 7th grade or below',            clientId: null },

  // Visual
  { id: 'rule_vis_01',  category: 'visual', text: 'Primary logo on light bg; monochrome mark on dark', clientId: null },
  { id: 'rule_vis_02',  category: 'visual', text: 'Accent colors limited to brand palette',           clientId: null },
  { id: 'rule_vis_03',  category: 'visual', text: 'Min logo clearspace: 1x height',                  clientId: null },
  { id: 'rule_vis_04',  category: 'visual', text: 'No drop shadows on logos',                         clientId: null },
];

export const COMPETITORS: Competitor[] = [
  { clientId: 'acme',    domain: 'brightsmile.co',     industry: 'Dental',     since: 'Mar 2025', velocity: 3, sov: 42, pillars: ['Family-friendly', 'Same-day crowns', 'Financing'], newPageDaysAgo: 1 },
  { clientId: 'acme',    domain: 'smileworks.com',     industry: 'Dental',     since: 'Mar 2025', velocity: 8, sov: 68, pillars: ['Tech-forward', 'Invisalign', 'Luxury'],             newPageDaysAgo: 2 },
  { clientId: 'acme',    domain: 'happyteeth.dental',  industry: 'Dental',     since: 'Feb 2025', velocity: 4, sov: 55, pillars: ['Kids focus', 'Insurance', 'Emergency'],             newPageDaysAgo: 3 },
  { clientId: 'acme',    domain: 'rivercrestdds.com',  industry: 'Dental',     since: 'Apr 2025', velocity: 5, sov: 48, pillars: ['Preventive', 'Whitening', 'Eco-materials'],         newPageDaysAgo: 4 },
  { clientId: 'seaside', domain: 'bayflowyoga.com',    industry: 'Wellness',   since: 'Feb 2025', velocity: 6, sov: 61, pillars: ['Teacher training', 'Retreats', 'Lifestyle'],        newPageDaysAgo: null },
  { clientId: 'seaside', domain: 'morningtidefit.com', industry: 'Wellness',   since: 'Mar 2025', velocity: 4, sov: 37, pillars: ['Outdoor fitness', 'Community', 'Habit coaching'],   newPageDaysAgo: 5 },
  { clientId: 'bloom',   domain: 'meadowstemshop.com', industry: 'Retail',     since: 'Mar 2025', velocity: 3, sov: 45, pillars: ['Subscriptions', 'Weddings', 'Local delivery'],      newPageDaysAgo: 6 },
  { clientId: 'bloom',   domain: 'fernandfig.shop',    industry: 'Retail',     since: 'Apr 2025', velocity: 2, sov: 29, pillars: ['Dried arrangements', 'Sympathy', 'Corporate'],      newPageDaysAgo: null },
];
