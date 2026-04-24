import type {
  Asset,
  BrandProfile,
  Campaign,
  Client,
  ClientCardStats,
  ClientKpis,
  ClientPerfRow,
  Competitor,
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
      { id: 'acme-dt', name: 'Acme Dental — Downtown' },
      { id: 'acme-mt', name: 'Acme Dental — Midtown' },
      { id: 'acme-ws', name: 'Acme Dental — Westside' },
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
      { id: 'nsa-ford', name: 'Northside Ford' },
      { id: 'nsa-kia', name: 'Northside Kia' },
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
];

/**
 * Scraped domains per client. One row per connected website. Page
 * counts are denormalized from SCRAPED_PAGES for card-display speed.
 */
export const SCRAPED_DOMAINS: ScrapedDomain[] = [
  { id: 'dom_acme_01',  clientId: 'acme',    domain: 'acmedental.com',     health: 'Healthy',  pageCount: 24, lastScrapedLabel: '2d ago' },
  { id: 'dom_sea_01',   clientId: 'seaside', domain: 'seasideyoga.com',    health: 'Healthy',  pageCount: 9,  lastScrapedLabel: '5d ago' },
  { id: 'dom_blm_01',   clientId: 'bloom',   domain: 'bloomandvine.co',    health: 'Warnings', pageCount: 14, lastScrapedLabel: '12h ago' },
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

export const COMPETITORS: Competitor[] = [
  { clientId: 'acme', domain: 'brightsmile.co',    industry: 'Dental', since: 'Mar 2025', velocity: 3, sov: 42, pillars: ['Family-friendly', 'Same-day crowns', 'Financing'] },
  { clientId: 'acme', domain: 'smileworks.com',    industry: 'Dental', since: 'Mar 2025', velocity: 8, sov: 68, pillars: ['Tech-forward', 'Invisalign', 'Luxury'] },
  { clientId: 'acme', domain: 'happyteeth.dental', industry: 'Dental', since: 'Feb 2025', velocity: 4, sov: 55, pillars: ['Kids focus', 'Insurance', 'Emergency'] },
];
