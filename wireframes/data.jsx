// CanopyStudio — sample data (deterministic)

const CLIENTS = [
  { id: 'acme', name: 'Acme Dental', industry: 'Dental / Healthcare', complete: 86, parent: true, locations: [
    { id: 'acme-dt', name: 'Acme Dental — Downtown' },
    { id: 'acme-mt', name: 'Acme Dental — Midtown' },
    { id: 'acme-ws', name: 'Acme Dental — Westside' },
  ]},
  { id: 'seaside', name: 'Seaside Yoga', industry: 'Fitness / Wellness', complete: 72 },
  { id: 'northside', name: 'Northside Auto Group', industry: 'Automotive', complete: 54, parent: true, locations: [
    { id: 'nsa-ford', name: 'Northside Ford' },
    { id: 'nsa-kia', name: 'Northside Kia' },
  ]},
  { id: 'bloom', name: 'Bloom & Vine Florist', industry: 'Retail / E-commerce', complete: 91 },
  { id: 'kettle', name: 'Kettle & Crumb Bakery', industry: 'Food & Beverage', complete: 44 },
  { id: 'harbor', name: 'Harbor Legal Partners', industry: 'Professional Services', complete: 66 },
  { id: 'pine', name: 'Pinecrest Family Dentistry', industry: 'Dental / Healthcare', complete: 38 },
  { id: 'lumen', name: 'Lumen Eyecare', industry: 'Optometry', complete: 78 },
  { id: 'summit', name: 'Summit Roofing Co.', industry: 'Home Services', complete: 60 },
];

const CLIENT_PERF = [
  { name: 'Acme Dental', spend: '$18,420', conv: 142, roas: '3.8x', cpl: '$48', spark: 3, status: 'Active', delta: 12.4 },
  { name: 'Seaside Yoga', spend: '$6,210', conv: 58, roas: '2.4x', cpl: '$31', spark: 7, status: 'Active', delta: -6.1 },
  { name: 'Northside Auto Group', spend: '$42,880', conv: 68, roas: '5.2x', cpl: '$184', spark: 11, status: 'Active', delta: 4.2 },
  { name: 'Bloom & Vine Florist', spend: '$3,940', conv: 112, roas: '4.1x', cpl: '$12', spark: 5, status: 'Active', delta: 18.3 },
  { name: 'Kettle & Crumb Bakery', spend: '$1,210', conv: 28, roas: '1.9x', cpl: '$22', spark: 2, status: 'Paused', delta: -22.0 },
  { name: 'Harbor Legal Partners', spend: '$9,620', conv: 41, roas: '6.8x', cpl: '$96', spark: 9, status: 'Active', delta: 8.7 },
  { name: 'Pinecrest Family Dentistry', spend: '$4,180', conv: 29, roas: '2.1x', cpl: '$62', spark: 4, status: 'Active', delta: -2.4 },
  { name: 'Lumen Eyecare', spend: '$7,340', conv: 71, roas: '3.4x', cpl: '$38', spark: 6, status: 'Active', delta: 6.0 },
];

const CAMPAIGNS = [
  { name: 'Leads | ASO | Group Events | April 2025', strategy: 'Lead Gen', spend: '$4,820', conv: 42, roas: '4.2x', cpl: '$38', status: 'Active', id: 'cmp_82910' },
  { name: 'Add to Cart | Birthdays | 2025', strategy: 'ATC', spend: '$2,104', conv: 88, roas: '2.8x', cpl: '$14', status: 'Active', id: 'cmp_82911' },
  { name: 'Purchase | Spring Sale | 2025', strategy: 'Purchase', spend: '$8,612', conv: 121, roas: '6.1x', cpl: '$22', status: 'Active', id: 'cmp_82912' },
  { name: 'Traffic | Local SEO Boost | Q2', strategy: 'Traffic', spend: '$960', conv: 14, roas: '1.4x', cpl: '$61', status: 'Paused', id: 'cmp_82913' },
  { name: 'Video | Brand Awareness | April', strategy: 'Video', spend: '$1,480', conv: 6, roas: '0.8x', cpl: '$220', status: 'Active', id: 'cmp_82914' },
  { name: 'Leads | New Patient Forms | April', strategy: 'Lead Gen', spend: '$3,220', conv: 48, roas: '3.6x', cpl: '$44', status: 'Active', id: 'cmp_82915' },
];

const POSTS_WEEK = [
  { day: 0, list: [{ status: 'Published', fmt: 'Post', client: 'Acme Dental' }] },
  { day: 1, list: [{ status: 'Scheduled', fmt: 'Reel', client: 'Seaside Yoga' }, { status: 'Draft', fmt: 'Post', client: 'Bloom & Vine' }] },
  { day: 2, list: [{ status: 'Approved', fmt: 'Carousel', client: 'Northside Ford' }] },
  { day: 3, list: [{ status: 'Scheduled', fmt: 'Post', client: 'Lumen Eyecare' }, { status: 'Scheduled', fmt: 'Post', client: 'Acme Dental' }] },
  { day: 4, list: [{ status: 'Error', fmt: 'Reel', client: 'Kettle & Crumb' }] },
  { day: 5, list: [{ status: 'Draft', fmt: 'Post', client: 'Harbor Legal' }] },
  { day: 6, list: [] },
];

const URGENT = [
  { sev: 'red', title: 'CPL 3.2× higher than account avg on Acme Dental → Leads | ASO | April', body: 'This campaign has spent $4,820 with 12 conversions this week — budget pacing will exhaust daily cap by Friday. Consider pausing the underperforming ad set "ASO — Broad".' },
  { sev: 'amber', title: 'Bloom & Vine CTR dropped 28% week-over-week', body: 'Creative fatigue likely — all 3 active ads are >14 days old. Generate 2–3 new variations grounded in the top performer from March.' },
  { sev: 'amber', title: 'Northside Kia has no conversions in last 7 days', body: 'Tracking pixel may be misfiring. 4 campaigns active, $8,420 spend, zero reported conversions. Verify META pixel events.' },
];

const POSTS_QUEUE = [
  { thumb: 1, client: 'Acme Dental', chan: ['fb','ig'], when: 'Apr 22 · 09:30', fmt: 'Reel', status: 'Queued' },
  { thumb: 2, client: 'Seaside Yoga', chan: ['ig'], when: 'Apr 22 · 14:00', fmt: 'Post', status: 'Queued' },
  { thumb: 3, client: 'Bloom & Vine', chan: ['fb','ig'], when: 'Apr 22 · 17:15', fmt: 'Carousel', status: 'Publishing' },
  { thumb: 4, client: 'Lumen Eyecare', chan: ['fb'], when: 'Apr 22 · 08:00', fmt: 'Post', status: 'Published' },
  { thumb: 5, client: 'Northside Ford', chan: ['fb','ig'], when: 'Apr 21 · 11:00', fmt: 'Post', status: 'Published' },
  { thumb: 6, client: 'Kettle & Crumb', chan: ['ig'], when: 'Apr 21 · 16:30', fmt: 'Reel', status: 'Failed' },
];

const COMPETITORS = [
  { domain: 'brightsmile.co', industry: 'Dental', since: 'Mar 2025', velocity: 3, sov: 42, pillars: ['Family-friendly','Same-day crowns','Financing'] },
  { domain: 'smileworks.com', industry: 'Dental', since: 'Mar 2025', velocity: 8, sov: 68, pillars: ['Tech-forward','Invisalign','Luxury'] },
  { domain: 'happyteeth.dental', industry: 'Dental', since: 'Feb 2025', velocity: 4, sov: 55, pillars: ['Kids focus','Insurance','Emergency'] },
];

Object.assign(window, { CLIENTS, CLIENT_PERF, CAMPAIGNS, POSTS_WEEK, URGENT, POSTS_QUEUE, COMPETITORS });
