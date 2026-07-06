// Task registry: maps a job's `type` to the prompts the orchestrator
// should run. Each builder loads whatever context it needs (brand
// profile, scraped pages, landing page) with the service client and
// returns an OrchestratedPromptSpec. Adding an AI capability = adding a
// builder here.

// deno-lint-ignore-file no-explicit-any
import type { ServiceClient } from '../auth.ts';
import { notifyWorkspace, sendEmail, sendSlack } from '../notify.ts';
import { landingPageSection } from '../scrape.ts';
import type { OrchestratedPromptSpec } from './orchestrator.ts';
import { loadSkills } from './orchestrator.ts';
import {
  buildCreativeDirectionsPrompt,
  buildUserPrompt,
  buildUserPromptWithDirection,
  formatClientContext,
  skillsBlock,
  systemPromptWithSkills,
  type BrandContext,
  type CampaignContext,
  type CreativeDirection,
} from './prompts.ts';

export interface JobRow {
  id: string;
  workspace_id: string;
  client_id: string | null;
  type: string;
  input: any;
}

export type SpecBuilder = (
  service: ServiceClient,
  job: JobRow,
) => Promise<OrchestratedPromptSpec>;

// ---------------------------------------------------------------------------
// Context loaders
// ---------------------------------------------------------------------------

/** Brand context for a client: name + website from `clients`, richer
 * fields from `brand_profiles` when that table/row exists (Phase 2 —
 * failures are tolerated so generation works before it lands). */
async function loadBrandContext(
  service: ServiceClient,
  clientId: string,
): Promise<BrandContext> {
  const { data: client } = await service
    .from('clients')
    .select('id, name, website, industry')
    .eq('id', clientId)
    .maybeSingle();

  const ctx: BrandContext = {
    name: (client?.name as string) ?? 'Unknown client',
    company_description: client?.industry ? `Industry: ${client.industry}` : null,
  };

  try {
    const { data: profile } = await service
      .from('brand_profiles')
      .select('description, customer_avatars, brand_voice, dos, donts, additional_notes')
      .eq('client_id', clientId)
      .maybeSingle();
    if (profile) {
      ctx.company_description =
        (profile.description as string | null) ?? ctx.company_description;
      ctx.customer_avatars = profile.customer_avatars as string | null;
      ctx.brand_voice = profile.brand_voice as string | null;
      ctx.dos = profile.dos as string | null;
      ctx.donts = profile.donts as string | null;
      ctx.additional_notes = profile.additional_notes as string | null;
    }
  } catch (_e) {
    // brand_profiles not migrated yet — client name/industry is enough.
  }

  return ctx;
}

/** Location-scoped jobs treat the client as the parent brand and the
 * location as the "child" (the donor app's parent/child model). */
async function loadLocationContext(
  service: ServiceClient,
  locationId: string,
): Promise<BrandContext | null> {
  const { data } = await service
    .from('locations')
    .select('name, address')
    .eq('id', locationId)
    .maybeSingle();
  if (!data) return null;
  return {
    name: data.name as string,
    company_description: data.address ? `Location address: ${data.address}` : null,
  };
}

/** Highest-signal scraped pages for grounding, kept small on purpose —
 * the landing page (explicit user input) matters more than bulk. */
async function scrapedContentSection(
  service: ServiceClient,
  clientId: string,
): Promise<string> {
  const { data } = await service
    .from('scraped_pages')
    .select('url, title, content, word_count')
    .eq('client_id', clientId)
    .is('competitor_id', null)
    // 'all'-excluded pages are withheld from the AI ('scrape'-excluded ones
    // still contribute their last recorded content).
    .neq('excluded', 'all')
    .order('word_count', { ascending: false })
    .limit(3);
  if (!data?.length) return '';
  const parts = data.map((p: any) => {
    const content = ((p.content as string) ?? '').slice(0, 2500);
    return `PAGE ${p.url}${p.title ? ` — "${p.title}"` : ''}:\n${content}`;
  });
  return parts.join('\n\n');
}

interface GenerationScope {
  client: BrandContext;
  parent: BrandContext | null;
  campaign: CampaignContext;
  sourceContent: string;
  system: string;
}

/** Shared context assembly for the copy tasks: brand + optional
 * location + landing page + scraped pages + skills. */
async function loadGenerationScope(
  service: ServiceClient,
  job: JobRow,
  task: string,
): Promise<GenerationScope> {
  if (!job.client_id) throw new Error(`${task} requires a client_id`);
  const input = job.input ?? {};

  const [clientCtx, locationCtx, skills, landing, scraped] = await Promise.all([
    loadBrandContext(service, job.client_id),
    input.location_id
      ? loadLocationContext(service, input.location_id as string)
      : Promise.resolve(null),
    loadSkills(service, job.workspace_id, task),
    landingPageSection(input.landing_page_url as string | undefined),
    scrapedContentSection(service, job.client_id),
  ]);

  // Location-scoped: client brand is the parent, location is the child.
  const client = locationCtx ?? clientCtx;
  const parent = locationCtx ? clientCtx : null;

  const campaign: CampaignContext = {
    name:
      (input.campaign_name as string | undefined)?.trim() ||
      ((input.campaign_idea as string | undefined) ?? 'New campaign').slice(0, 80),
    goal: (input.campaign_idea as string | undefined) ?? null,
    medium: (input.medium as string | undefined) ?? 'BOTH',
    campaign_context: (input.additional_context as string | undefined) ?? null,
  };

  const sourceContent = [landing, scraped].filter(Boolean).join('\n\n');

  return { client, parent, campaign, sourceContent, system: systemPromptWithSkills(skills) };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const COPY_REVIEW_INSTRUCTIONS = `Provide a thorough review with:
1. What works well (keep these)
2. Character limit issues (Google headlines max 30, descriptions max 90, META headlines max 25)
3. Variety issues (are headlines/descriptions too similar?)
4. Brand voice alignment issues
5. Missing opportunities or weak copy
6. Whether the signals array has EXACTLY 50 items`;

/** copy_generation — the core Ad Studio flow (Swimm's generateCopy /
 * generateCopyWithDirection, grounded in landing page + scraped site). */
const copyGeneration: SpecBuilder = async (service, job) => {
  const scope = await loadGenerationScope(service, job, 'copy_generation');
  const direction = (job.input?.direction as CreativeDirection | undefined) ?? null;

  const user = direction
    ? buildUserPromptWithDirection(
        scope.client,
        scope.campaign,
        '',
        direction,
        scope.sourceContent,
        scope.parent,
      )
    : buildUserPrompt(scope.client, scope.campaign, '', scope.sourceContent, scope.parent);

  return {
    system: scope.system,
    user,
    reviewInstructions: COPY_REVIEW_INSTRUCTIONS,
    json: true,
  };
};

/** creative_directions — 3 concept angles offered before generating. */
const creativeDirections: SpecBuilder = async (service, job) => {
  const scope = await loadGenerationScope(service, job, 'creative_directions');
  const adjustments = (job.input?.adjustments as string | undefined) ?? '';

  return {
    system: scope.system,
    user: buildCreativeDirectionsPrompt(
      scope.client,
      scope.campaign,
      adjustments,
      scope.sourceContent,
      scope.parent,
    ),
    reviewInstructions:
      'Check that the 3 directions are meaningfully different from each other (distinct emotional appeals or angles), realistic for this brand, and each has a sharp title, hook, description, and exactly 3 themes.',
    json: true,
  };
};

const EXPAND_LABELS: Record<string, { label: string; charLimit: number | null }> = {
  keywords: { label: 'Google Ads keywords', charLimit: null },
  signals: { label: 'audience signals', charLimit: null },
  headlines: { label: 'Google Ads headlines', charLimit: 30 },
  descriptions: { label: 'Google Ads descriptions', charLimit: 90 },
  meta_primary_text: { label: 'META primary text options', charLimit: null },
  meta_headlines: { label: 'META headlines', charLimit: 25 },
};

/** expand_content — "Add more with AI" on any results list (donor's
 * expandContent, including the don't-duplicate rule + dedupe pass). */
const expandContent: SpecBuilder = async (service, job) => {
  const input = job.input ?? {};
  const target = (input.target as string) ?? 'keywords';
  const meta = EXPAND_LABELS[target] ?? { label: target, charLimit: null };
  const existing: string[] = Array.isArray(input.existing) ? input.existing : [];
  const count = Math.min(Math.max(Number(input.count) || 10, 1), 50);
  const suggestion = (input.suggestion as string | undefined) ?? '';

  const [clientCtx, skills] = await Promise.all([
    job.client_id
      ? loadBrandContext(service, job.client_id)
      : Promise.resolve<BrandContext>({ name: 'the client' }),
    loadSkills(service, job.workspace_id, 'expand_content'),
  ]);

  const existingLower = new Set(existing.map((s) => s.trim().toLowerCase()));

  return {
    system: systemPromptWithSkills(skills),
    user: `${formatClientContext(clientCtx)}

## TASK
You are expanding a list of ${meta.label} for an advertising campaign.

## EXISTING ITEMS (do NOT duplicate any of these)
${existing.slice(0, 30).join('\n') || '(none yet)'}

## USER DIRECTION
${suggestion || 'None — keep the same style and intent as the existing items.'}

Generate EXACTLY ${count} NEW items${
      meta.charLimit ? `, each EXACTLY ${meta.charLimit} characters or less (count carefully!)` : ''
    }. Each must be meaningfully different from every existing item and from each other.

Return valid JSON: { "items": ["...", "..."] }`,
    reviewInstructions: `Check there are exactly ${count} items, none duplicates an existing item${
      meta.charLimit ? `, and every item is within ${meta.charLimit} characters` : ''
    }.`,
    json: true,
    finalize: (result: any) => {
      const items: string[] = Array.isArray(result?.items) ? result.items : [];
      const seen = new Set(existingLower);
      const deduped: string[] = [];
      for (const item of items) {
        const key = String(item).trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(String(item).trim());
      }
      return { items: deduped, target, count: deduped.length };
    },
  };
};

const REGEN_LIMITS: Record<string, { label: string; charLimit: number | null }> = {
  google_headline: { label: 'Google Ads headline', charLimit: 30 },
  google_description: { label: 'Google Ads description', charLimit: 90 },
  meta_headline: { label: 'META headline', charLimit: 25 },
  meta_primary_text: { label: 'META primary text', charLimit: null },
  keyword: { label: 'Google Ads keyword', charLimit: null },
  signal: { label: 'audience signal', charLimit: null },
};

/** regenerate_single — rewrite one item, optionally with an instruction. */
const regenerateSingle: SpecBuilder = async (service, job) => {
  const input = job.input ?? {};
  const itemType = (input.item_type as string) ?? 'google_headline';
  const meta = REGEN_LIMITS[itemType] ?? { label: itemType, charLimit: null };
  const currentValue = (input.current_value as string) ?? '';
  const instruction = (input.instruction as string | undefined) ?? '';

  const [clientCtx, skills] = await Promise.all([
    job.client_id
      ? loadBrandContext(service, job.client_id)
      : Promise.resolve<BrandContext>({ name: 'the client' }),
    loadSkills(service, job.workspace_id, 'regenerate_single'),
  ]);

  return {
    system: systemPromptWithSkills(skills),
    user: `${formatClientContext(clientCtx)}

## TASK
Rewrite this ${meta.label}:

"${currentValue}"

${instruction ? `## INSTRUCTION\n${instruction}\n` : ''}
Requirements:
- Produce ONE alternative that is meaningfully different but serves the same intent
${meta.charLimit ? `- EXACTLY ${meta.charLimit} characters or less (count carefully!)` : ''}
- Match the brand voice and guidelines above

Return valid JSON: { "value": "..." }`,
    reviewInstructions: `Check the rewrite is genuinely different from "${currentValue}", on-brand${
      meta.charLimit ? `, and within ${meta.charLimit} characters` : ''
    }.`,
    json: true,
  };
};

/** website_analysis — scraped pages → brand profile. The prompt is the
 * donor app's analyzeWebsite mission, with dos/donts split into the two
 * fields Canopy stores. finalize() upserts brand_profiles, folding in
 * the scraper's design signals and skipping human-edited fields. */
const websiteAnalysis: SpecBuilder = async (service, job) => {
  if (!job.client_id) throw new Error('website_analysis requires a client_id');
  const clientId = job.client_id;

  const [{ data: pages }, { data: domainRow }, skills, { data: clientRow }] = await Promise.all([
    service
      .from('scraped_pages')
      .select('url, title, content')
      .eq('client_id', clientId)
      .is('competitor_id', null)
      // Withhold 'all'-excluded pages from the brand analysis.
      .neq('excluded', 'all')
      .order('word_count', { ascending: false })
      .limit(12),
    service
      .from('scraped_domains')
      .select('domain, raw_palette, raw_fonts, logo_url')
      .eq('client_id', clientId)
      .is('competitor_id', null)
      .order('last_crawled_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadSkills(service, job.workspace_id, 'website_analysis'),
    service.from('clients').select('name, website').eq('id', clientId).maybeSingle(),
  ]);

  if (!pages?.length) {
    throw new Error('No scraped pages for this client yet — run a website scrape first.');
  }

  const url =
    (job.input?.url as string | undefined) ??
    (clientRow?.website as string | undefined) ??
    (domainRow?.domain as string | undefined) ??
    'unknown';

  // Budget the content across pages (the donor truncates at 30k chars).
  const MAX_TOTAL = 28_000;
  const perPage = Math.max(1500, Math.floor(MAX_TOTAL / pages.length));
  const websiteContent = pages
    .map(
      (p: any) =>
        `--- ${p.url}${p.title ? ` ("${p.title}")` : ''} ---\n${((p.content as string) ?? '').slice(0, perPage)}`,
    )
    .join('\n\n')
    .slice(0, MAX_TOTAL);

  return {
    system:
      'You are a brand analyst that extracts brand information from websites. Always respond with valid JSON.' +
      skillsBlock(skills),
    user: buildWebsiteAnalysisPrompt(websiteContent, url),
    reviewInstructions:
      'Check every field is grounded in the actual website content (no invented facts), the customer avatars are specific, and dos/donts are actionable single-line rules separated by newlines.',
    json: true,
    llmOptions: { temperature: 0.3 },
    finalize: async (result: any) => {
      const { data: existing } = await service
        .from('brand_profiles')
        .select('edited_fields')
        .eq('client_id', clientId)
        .maybeSingle();
      const edited = (existing?.edited_fields as Record<string, boolean> | null) ?? {};

      const analyzed: Record<string, unknown> = {
        description: result?.company_description ?? null,
        customer_avatars: result?.customer_avatars ?? null,
        brand_voice: result?.brand_voice ?? null,
        dos: result?.dos ?? null,
        donts: result?.donts ?? null,
        additional_notes: result?.additional_notes ?? null,
        palette: domainRow?.raw_palette ?? null,
        fonts: domainRow?.raw_fonts ?? null,
        logo_url: domainRow?.logo_url ?? null,
      };
      // Human edits win: drop any field the user has customized.
      for (const key of Object.keys(analyzed)) {
        if (edited[key]) delete analyzed[key];
      }

      const { error } = await service.from('brand_profiles').upsert(
        {
          client_id: clientId,
          ...analyzed,
          analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' },
      );
      if (error) throw new Error(`Failed to save brand profile: ${error.message}`);
      return { ...result, saved: true, skipped_edited_fields: Object.keys(edited) };
    },
  };
};

function buildWebsiteAnalysisPrompt(websiteContent: string, url: string): string {
  return `You are an expert brand strategist and digital marketing analyst specializing in extracting actionable brand intelligence from website content. Your analysis will be used to create high-converting advertising campaigns.

## WEBSITE BEING ANALYZED
URL: ${url}

The content below was scraped from multiple pages of this website (home, about, services, etc.).

## YOUR MISSION
Extract comprehensive brand knowledge that a marketing copywriter can immediately use to create compelling Google Ads and META (Facebook/Instagram) advertising campaigns.

## WHAT TO EXTRACT

### 1. Company Overview & Positioning
- What exactly does this company do? Be specific about products/services
- What is their unique selling proposition (USP)?
- What market/industry do they serve?
- What makes them different from competitors?
- What problems do they solve?

### 2. Target Audience Intelligence
- Who are their ideal customers? (Demographics: age, location, income, profession)
- What psychographics define their audience? (Values, interests, lifestyle)
- What pain points and frustrations does the audience have?
- What desires, goals, and aspirations drive them?
- What objections might prevent them from buying?
- What would trigger them to take action NOW?

### 3. Brand Voice & Communication Style
- How does the website communicate? (Tone: professional, casual, playful, authoritative, empathetic)
- What personality comes through? (Innovative, trustworthy, bold, caring, luxurious, approachable)
- What specific words, phrases, or terminology do they use repeatedly?
- What emotions do they try to evoke?
- What reading level and complexity is the copy written at?

### 4. Key Messages & Value Propositions
- What are the main benefits they highlight? (Not features, benefits)
- What transformation do they promise customers?
- What proof points, statistics, or credentials do they share?
- What testimonials or case studies are mentioned?
- What guarantees or risk-reversals do they offer?

### 5. Brand Guidelines (Do's and Don'ts)
- What communication style should always be maintained?
- What topics or claims should be avoided?
- Are there industry-specific compliance considerations?
- What competitors should never be mentioned?
- What messaging would feel "off-brand" for them?

### 6. Marketing-Ready Insights
- What emotional triggers could drive conversions?
- What urgency or scarcity angles exist naturally?
- What seasonal or timely opportunities exist?
- What calls-to-action do they currently use?
- What offers or promotions are mentioned?

## WEBSITE CONTENT TO ANALYZE

${websiteContent}

## OUTPUT FORMAT
Synthesize all findings into immediately actionable brand knowledge. Return your response as JSON:
{
  "company_description": "Comprehensive company description with positioning, USP, and what they do...",
  "customer_avatars": "Detailed target audience analysis including demographics, psychographics, pain points, desires, objections, and buying triggers...",
  "brand_voice": "Complete brand voice guide with tone, personality, key phrases, and communication style to emulate...",
  "dos": "Things copy SHOULD always do for this brand — one rule per line...",
  "donts": "Things copy must NEVER do for this brand — one rule per line...",
  "additional_notes": "Marketing-ready insights including emotional triggers, proof points, CTAs, offers, and campaign angles...",
  "sources": ["Website: ${url}"]
}`;
}

/** competitor_analysis — client brand vs one competitor's scraped site.
 * Produces a comparison table, gap angles (draftable in Ad Studio), and
 * a takeaway. finalize() stores the analysis on the competitor row and
 * replaces its gap_angles. */
const competitorAnalysis: SpecBuilder = async (service, job) => {
  if (!job.client_id) throw new Error('competitor_analysis requires a client_id');
  const clientId = job.client_id;
  const competitorId = job.input?.competitor_id as string | undefined;
  if (!competitorId) throw new Error('competitor_analysis requires input.competitor_id');

  const [{ data: competitor }, clientCtx, { data: compPages }, skills] = await Promise.all([
    service
      .from('competitors')
      .select('id, domain, name')
      .eq('id', competitorId)
      .eq('client_id', clientId)
      .maybeSingle(),
    loadBrandContext(service, clientId),
    service
      .from('scraped_pages')
      .select('url, title, content')
      .eq('competitor_id', competitorId)
      .order('word_count', { ascending: false })
      .limit(8),
    loadSkills(service, job.workspace_id, 'competitor_analysis'),
  ]);

  if (!competitor) throw new Error('Competitor not found for this client');
  if (!compPages?.length) {
    throw new Error('No scraped pages for this competitor yet — scrape their site first.');
  }

  const perPage = Math.max(1500, Math.floor(20_000 / compPages.length));
  const competitorContent = compPages
    .map(
      (p: any) =>
        `--- ${p.url}${p.title ? ` ("${p.title}")` : ''} ---\n${((p.content as string) ?? '').slice(0, perPage)}`,
    )
    .join('\n\n');

  const competitorName = (competitor.name as string) || (competitor.domain as string);

  return {
    system:
      'You are a competitive-intelligence strategist for advertising teams. You compare a client brand against a competitor using only evidence from the provided content. Always respond with valid JSON.' +
      skillsBlock(skills),
    user: `## OUR CLIENT (the brand we work for)
${formatClientContext(clientCtx)}

## COMPETITOR BEING ANALYZED
Name: ${competitorName}
Domain: ${competitor.domain}

## COMPETITOR WEBSITE CONTENT (scraped)
${competitorContent}

## YOUR TASK
Compare the competitor's positioning, offers, messaging, and calls-to-action against our client. Then identify GAP ANGLES: specific, actionable advertising angles our client could run that the competitor is missing, or that neutralize a competitor strength. Every claim must be grounded in the content above — no invented facts.

Return valid JSON with this exact structure:
{
  "positioning_summary": "2-3 sentences on how this competitor positions itself and to whom",
  "comparison_rows": [
    { "dimension": "e.g. Pricing transparency", "client": "what our client does", "competitor": "what the competitor does", "advantage": "client" | "competitor" | "neutral" }
  ],
  "gap_angles": [
    { "title": "Short angle name", "confidence": 0-100, "evidence": "1-2 sentences citing what in the content supports this angle" }
  ],
  "takeaway": "The single most important strategic takeaway for our client's advertising"
}

Provide 4-6 comparison_rows and 3-5 gap_angles.`,
    reviewInstructions:
      'Check every comparison row and gap angle is grounded in the provided competitor content (no invented facts), the gap angles are specific enough to brief an ad from, and confidence scores are justified by the evidence.',
    json: true,
    llmOptions: { temperature: 0.3 },
    finalize: async (result: any) => {
      const now = new Date().toISOString();
      const { error: updateErr } = await service
        .from('competitors')
        .update({
          analysis: {
            positioning_summary: result?.positioning_summary ?? null,
            comparison_rows: result?.comparison_rows ?? [],
            takeaway: result?.takeaway ?? null,
          },
          analyzed_at: now,
        })
        .eq('id', competitorId);
      if (updateErr) throw new Error(`Failed to save analysis: ${updateErr.message}`);

      // Replace this competitor's gap angles with the fresh set.
      await service.from('gap_angles').delete().eq('competitor_id', competitorId);
      const angles = Array.isArray(result?.gap_angles) ? result.gap_angles : [];
      if (angles.length) {
        const { error: gapErr } = await service.from('gap_angles').insert(
          angles.map((a: any) => ({
            client_id: clientId,
            competitor_id: competitorId,
            title: String(a.title ?? 'Untitled angle'),
            confidence: Math.max(0, Math.min(100, Number(a.confidence) || 50)),
            evidence: a.evidence ? String(a.evidence) : null,
          })),
        );
        if (gapErr) throw new Error(`Failed to save gap angles: ${gapErr.message}`);
      }
      return { ...result, saved: true };
    },
  };
};

/** account_analysis — campaign performance review → suggestions.
 * The strategy rules are ported verbatim from ad-optimizer's
 * analyzeAdPerformance (judge lead-gen on CPL, warm-ups on engagement,
 * purchase on ROAS — always via campaign_strategy, never Meta's
 * objective). Data comes from Supabase only; Meta is never called here.
 * finalize() writes analyses + suggestions rows and pings connectors. */
const accountAnalysis: SpecBuilder = async (service, job) => {
  if (!job.client_id) throw new Error('account_analysis requires a client_id');
  const clientId = job.client_id;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [clientCtx, { data: clientRow }, { data: campaigns }, { data: history }, competitorsRes, skills] =
    await Promise.all([
      loadBrandContext(service, clientId),
      service.from('clients').select('name').eq('id', clientId).maybeSingle(),
      service
        .from('campaigns')
        .select(
          'id, ad_account_id, name, status, objective, strategy, daily_spend, mtd_spend, daily_results, daily_result_type, daily_cost_per_result, mtd_results, mtd_result_type, mtd_cost_per_result, impressions, clicks, cpc, cpm, ctr, reach, frequency, roas, last_refreshed_at',
        )
        .eq('client_id', clientId),
      service
        .from('campaign_metrics_daily')
        .select('campaign_id, date, spend, results, result_type, clicks, impressions')
        .eq('client_id', clientId)
        .gte('date', since)
        .order('date', { ascending: true }),
      service
        .from('competitors')
        .select('domain, name, analysis')
        .eq('client_id', clientId)
        .not('analysis', 'is', null),
      loadSkills(service, job.workspace_id, 'account_analysis'),
    ]);

  const activeCampaigns = (campaigns ?? []).filter(
    (c: any) => Number(c.mtd_spend) > 0 || Number(c.daily_spend) > 0 || c.status === 'ACTIVE',
  );
  if (!activeCampaigns.length) {
    throw new Error('No campaign data for this client yet — refresh from Meta first.');
  }

  const competitorNotes = ((competitorsRes.data ?? []) as any[])
    .map((c) => `- ${c.name ?? c.domain}: ${c.analysis?.takeaway ?? c.analysis?.positioning_summary ?? ''}`)
    .filter((line) => line.length > 4)
    .join('\n');

  const adData = {
    client: { name: clientCtx.name, brand_context: clientCtx.company_description },
    campaigns: activeCampaigns.map((c: any) => ({ ...c, campaign_strategy: c.strategy })),
    daily_history_last_30_days: history ?? [],
  };

  return {
    system:
      'You are an expert digital marketing analyst specializing in META Ads optimization. Always respond with valid JSON.' +
      skillsBlock(skills),
    user: `Analyze the following ad performance data for the client "${clientCtx.name}" and provide actionable recommendations:

${JSON.stringify(adData, null, 2)}

IMPORTANT CONTEXT ABOUT CAMPAIGN STRATEGIES:

Each campaign has a "campaign_strategy" field parsed from the campaign name. This is MORE ACCURATE than the META objective field. Use the campaign_strategy to determine how to evaluate performance:

1. "Lead Generation" campaigns:
   - Judge performance based on Cost Per Lead (CPL) against industry standards ($20-$100 for B2B, $5-$50 for local services)
   - If you see "purchase" conversions on a lead campaign, this is META's pixel tracking multiple events - NOT a conversion tracking issue
   - Do NOT flag as "tracking issues" or suggest fixing conversion tracking
   - Focus recommendations on: lead quality, CPL optimization, audience targeting, creative testing

2. "Add to Cart (Warm-up)", "View Content (Warm-up)", "Traffic (Warm-up)", or "Video Views (Warm-up)" campaigns:
   - These are warm-up campaigns to help accounts exit the learning phase and build pixel data
   - They are INTENTIONALLY optimizing for upper-funnel events, NOT purchases
   - Expected to get SOME purchases as a side effect, but that's not the goal
   - Do NOT criticize for "not getting purchases" or "poor conversion rates" - this is by design
   - Do NOT suggest changing optimization or adding conversion tracking
   - ONLY suggest adding a Purchase campaign when the account has MTD purchase conversions >= 10-15
   - Focus recommendations on: engagement metrics, reaching learning phase completion, building audience data, CTR, traffic quality

3. "Purchase" or "Sales" campaigns:
   - Judge performance on ROAS, CPA, and conversion volume
   - Standard benchmarks: CPA $20-$150 depending on product, ROAS 2.5-4.0x
   - Focus on conversion optimization and revenue metrics

CRITICAL: Always reference the "campaign_strategy" field to determine campaign type, NOT the "objective" field from META.
${competitorNotes ? `\nCOMPETITIVE CONTEXT (from competitor analyses — use for strategy suggestions):\n${competitorNotes}\n` : ''}
Provide:
1. A performance summary for this client (considering campaign strategies)
2. Specific, prioritized recommendations (each tied to a campaign where relevant)
3. Any urgent issues (do NOT flag conversion tracking as an issue for lead campaigns getting purchases)
4. The top 3-5 actions to take first

IMPORTANT: Output must be valid JSON only. Do NOT include any surrounding commentary or markdown. Use the EXACT JSON structure below:
{
  "overall_summary": "Brief performance overview for this client",
  "recommendations": [
    {
      "priority": "high|medium|low",
      "action": "specific action to take",
      "reasoning": "why this matters",
      "expected_impact": "predicted outcome",
      "campaign_id": "relevant campaign id or null"
    }
  ],
  "urgent_issues": ["list of urgent items"],
  "top_priorities": ["overall top 3-5 actions to take first"]
}`,
    reviewInstructions:
      'Check every recommendation respects the campaign_strategy rules (no "fix tracking" on lead campaigns, no "not converting" criticism of warm-ups), references real campaign ids from the data, and that priorities are justified by the numbers.',
    json: true,
    llmOptions: { temperature: 0.3 },
    finalize: async (result: any) => {
      const { data: analysisRow, error: aErr } = await service
        .from('analyses')
        .insert({
          workspace_id: job.workspace_id,
          client_id: clientId,
          kind: 'account',
          summary: {
            overall_summary: result?.overall_summary ?? null,
            urgent_issues: result?.urgent_issues ?? [],
            top_priorities: result?.top_priorities ?? [],
          },
        })
        .select('id')
        .single();
      if (aErr) throw new Error(`Failed to save analysis: ${aErr.message}`);

      const recs = Array.isArray(result?.recommendations) ? result.recommendations : [];
      if (recs.length) {
        const { error: sErr } = await service.from('suggestions').insert(
          recs.map((r: any) => ({
            workspace_id: job.workspace_id,
            client_id: clientId,
            analysis_id: analysisRow.id,
            priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
            action: String(r.action ?? 'Untitled suggestion'),
            reasoning: r.reasoning ? String(r.reasoning) : null,
            expected_impact: r.expected_impact ? String(r.expected_impact) : null,
            campaign_id: r.campaign_id ? String(r.campaign_id) : null,
          })),
        );
        if (sErr) throw new Error(`Failed to save suggestions: ${sErr.message}`);
      }

      // Ping configured channels (Slack always; email to the workspace
      // owner when resolvable). Best-effort.
      try {
        const clientName = (clientRow?.name as string) ?? clientCtx.name;
        const { data: ws } = await service
          .from('workspaces')
          .select('owner_id')
          .eq('id', job.workspace_id)
          .maybeSingle();
        let ownerEmail: string | undefined;
        if (ws?.owner_id) {
          const { data: owner } = await (service as any).auth.admin.getUserById(
            ws.owner_id as string,
          );
          ownerEmail = owner?.user?.email ?? undefined;
        }
        const high = recs.filter((r: any) => r.priority === 'high').length;
        await notifyWorkspace(service, {
          workspaceId: job.workspace_id,
          kind: 'suggestions',
          subject: `${recs.length} new suggestion${recs.length === 1 ? '' : 's'} for ${clientName}`,
          text: `${result?.overall_summary ?? ''}\n${high ? `${high} high priority. ` : ''}Review them on the CanopyStudio dashboard.`,
          emailTo: ownerEmail ? [ownerEmail] : undefined,
        });
      } catch (e) {
        console.error('[account_analysis] notify failed:', e);
      }

      return { ...result, analysis_id: analysisRow.id, suggestions_created: recs.length };
    },
  };
};

/** send_report — roll up the period's campaign_metrics_daily, write the
 * narrative through the orchestrator (report_summary settings + skills),
 * render HTML, deliver via the workspace connectors, log sent_reports.
 * Skips delivery when the period has no data (a refresh gap shouldn't
 * email a client an empty report). */
const sendReport: SpecBuilder = async (service, job) => {
  const settingsId = job.input?.report_settings_id as string | undefined;
  if (!settingsId) throw new Error('send_report requires input.report_settings_id');

  const { data: rs } = await service
    .from('report_settings')
    .select('id, workspace_id, client_id, cadence, channel, recipients, enabled')
    .eq('id', settingsId)
    .maybeSingle();
  if (!rs) throw new Error('Report settings not found');
  const clientId = rs.client_id as string;
  const cadence = rs.cadence as 'daily' | 'weekly' | 'monthly';

  // Period: full days only — "yesterday" is the newest complete day.
  const now = new Date(Date.now());
  const yesterday = new Date(now.getTime() - 86_400_000);
  let periodStart: Date;
  let periodEnd = yesterday;
  if (cadence === 'daily') {
    periodStart = yesterday;
  } else if (cadence === 'weekly') {
    periodStart = new Date(yesterday.getTime() - 6 * 86_400_000);
  } else {
    // The whole previous calendar month (the just-completed one). Anchor on
    // *now*, not yesterday: the monthly send fires on the 1st, so yesterday is
    // the last day of the prior month and anchoring on it would land the
    // report a further month back (an Aug-1 send would cover June, not July).
    const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    periodEnd = new Date(firstOfThisMonth.getTime() - 86_400_000);
    periodStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1));
  }
  const startStr = periodStart.toISOString().slice(0, 10);
  const endStr = periodEnd.toISOString().slice(0, 10);

  const [{ data: clientRow }, { data: metrics }, { data: campaigns }, skills] = await Promise.all([
    service.from('clients').select('name').eq('id', clientId).maybeSingle(),
    service
      .from('campaign_metrics_daily')
      .select('campaign_id, date, spend, impressions, clicks, results, result_type')
      .eq('client_id', clientId)
      .gte('date', startStr)
      .lte('date', endStr),
    service.from('campaigns').select('id, name, strategy').eq('client_id', clientId),
    loadSkills(service, job.workspace_id, 'report_summary'),
  ]);

  const clientName = (clientRow?.name as string) ?? 'Client';
  const nameById = new Map<string, any>(
    ((campaigns ?? []) as any[]).map((c) => [c.id as string, c]),
  );

  // Roll up per campaign.
  const perCampaign = new Map<
    string,
    { name: string; strategy: string | null; spend: number; clicks: number; impressions: number; results: number; resultType: string | null }
  >();
  for (const m of (metrics ?? []) as any[]) {
    const c = nameById.get(m.campaign_id as string);
    const agg = perCampaign.get(m.campaign_id) ?? {
      name: (c?.name as string) ?? m.campaign_id,
      strategy: (c?.strategy as string | null) ?? null,
      spend: 0,
      clicks: 0,
      impressions: 0,
      results: 0,
      resultType: (m.result_type as string | null) ?? null,
    };
    agg.spend += Number(m.spend) || 0;
    agg.clicks += Number(m.clicks) || 0;
    agg.impressions += Number(m.impressions) || 0;
    agg.results += Number(m.results) || 0;
    perCampaign.set(m.campaign_id, agg);
  }
  const rollup = Array.from(perCampaign.values())
    .filter((r) => r.spend > 0 || r.results > 0)
    .sort((a, b) => b.spend - a.spend);
  const totals = rollup.reduce(
    (t, r) => ({
      spend: t.spend + r.spend,
      clicks: t.clicks + r.clicks,
      impressions: t.impressions + r.impressions,
      results: t.results + r.results,
    }),
    { spend: 0, clicks: 0, impressions: 0, results: 0 },
  );

  const periodLabel =
    cadence === 'daily' ? endStr : `${startStr} → ${endStr}`;
  const subject = `${clientName} — ${cadence} ad report (${periodLabel})`;

  // No data → skip delivery entirely (finalize handles it via a flag).
  const hasData = rollup.length > 0;

  return {
    system:
      'You are a marketing analyst writing a short, client-friendly performance report. Plain language, no jargon, no invented numbers — only what is in the data. Always respond with valid JSON.' +
      skillsBlock(skills),
    user: `Write the narrative for a ${cadence} ad performance report.

## CLIENT
${clientName}

## PERIOD
${periodLabel}

## DATA (per campaign, ${cadence} totals)
${JSON.stringify({ totals, campaigns: rollup }, null, 2)}

Remember the campaign "strategy" semantics: Lead Gen is judged on cost per lead, warm-up campaigns (ATC/VC/Traffic/Video) on engagement — do not criticize warm-ups for not converting — and Purchase/Sales on ROAS.

Return valid JSON:
{
  "headline": "One-sentence topline a client understands",
  "summary": "2-4 sentence narrative of the period",
  "highlights": ["2-4 specific positive callouts with numbers"],
  "watchouts": ["0-3 things to keep an eye on, phrased constructively"]
}`,
    reviewInstructions:
      'Check every number quoted matches the data, the tone is client-friendly (no internal jargon), and warm-up campaigns are not criticized for lacking conversions.',
    json: true,
    llmOptions: { temperature: 0.4 },
    finalize: async (narrative: any) => {
      if (!hasData) {
        return { skipped: true, reason: 'No campaign activity in the period' };
      }

      const html = renderReportHtml({
        clientName,
        cadence,
        periodLabel,
        totals,
        rollup,
        narrative,
      });

      const channel = rs.channel as 'email' | 'slack' | 'both';
      const recipients = (rs.recipients as string[] | null) ?? [];
      const errors: string[] = [];
      let delivered = 0;

      if ((channel === 'email' || channel === 'both') && recipients.length) {
        const r = await sendEmail(service, {
          workspaceId: job.workspace_id,
          kind: 'report',
          to: recipients,
          subject,
          html,
        });
        if (r.ok) delivered++;
        else errors.push(`email: ${r.error}`);
      }
      if (channel === 'slack' || channel === 'both') {
        const highlights = (narrative?.highlights ?? []).map((h: string) => `• ${h}`).join('\n');
        const r = await sendSlack(service, {
          workspaceId: job.workspace_id,
          kind: 'report',
          text: `*${subject}*\n${narrative?.headline ?? ''}\n${narrative?.summary ?? ''}\n${highlights}`,
        });
        if (r.ok) delivered++;
        else errors.push(`slack: ${r.error}`);
      }

      // A partial failure (e.g. email delivered but the Slack webhook 500s)
      // must NOT mark the whole report failed: leaving last_sent_at unset
      // would make the next cron cycle re-send and double-deliver the channel
      // that already worked. Count it sent if anything went out (or nothing
      // needed to — 'email' cadence with no recipients); the partial error is
      // still recorded on the row for visibility. Only an all-channels failure
      // is a true failure that should retry.
      const sent = errors.length === 0 || delivered > 0;
      const errorText = errors.length ? errors.join('; ') : null;

      await service.from('sent_reports').insert({
        report_settings_id: rs.id,
        workspace_id: job.workspace_id,
        client_id: clientId,
        cadence,
        period_start: startStr,
        period_end: endStr,
        subject,
        body_html: html,
        status: sent ? 'sent' : 'failed',
        error: errorText,
      });
      if (sent) {
        await service
          .from('report_settings')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('id', rs.id);
      }
      return { ...narrative, sent, error: errorText, subject };
    },
  };
};

function renderReportHtml(args: {
  clientName: string;
  cadence: string;
  periodLabel: string;
  totals: { spend: number; clicks: number; impressions: number; results: number };
  rollup: Array<{ name: string; strategy: string | null; spend: number; clicks: number; results: number; resultType: string | null }>;
  narrative: any;
}): string {
  const { clientName, cadence, periodLabel, totals, rollup, narrative } = args;
  const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
  const esc = (s: unknown) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = rollup
    .map(
      (r) => `<tr>
  <td style="padding:8px;border-bottom:1px solid #eee;">${esc(r.name)}${r.strategy ? `<br><span style="color:#888;font-size:12px;">${esc(r.strategy)}</span>` : ''}</td>
  <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${money(r.spend)}</td>
  <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${r.clicks.toLocaleString()}</td>
  <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${r.results.toLocaleString()}${r.resultType ? `<br><span style="color:#888;font-size:12px;">${esc(r.resultType.replace(/_/g, ' '))}</span>` : ''}</td>
</tr>`,
    )
    .join('\n');

  const list = (items: string[] | undefined) =>
    (items ?? []).map((i) => `<li style="margin-bottom:4px;">${esc(i)}</li>`).join('');

  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a1a1a;">
  <h2 style="margin-bottom:4px;">${esc(clientName)} — ${esc(cadence)} ad report</h2>
  <p style="color:#666;margin-top:0;">${esc(periodLabel)}</p>
  <p style="font-size:16px;font-weight:600;">${esc(narrative?.headline)}</p>
  <p>${esc(narrative?.summary)}</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
    <tr style="text-align:left;color:#888;font-size:12px;text-transform:uppercase;">
      <th style="padding:8px;border-bottom:2px solid #ddd;">Campaign</th>
      <th style="padding:8px;border-bottom:2px solid #ddd;text-align:right;">Spend</th>
      <th style="padding:8px;border-bottom:2px solid #ddd;text-align:right;">Clicks</th>
      <th style="padding:8px;border-bottom:2px solid #ddd;text-align:right;">Results</th>
    </tr>
    ${rows}
    <tr style="font-weight:600;">
      <td style="padding:8px;">Total</td>
      <td style="padding:8px;text-align:right;">${money(totals.spend)}</td>
      <td style="padding:8px;text-align:right;">${totals.clicks.toLocaleString()}</td>
      <td style="padding:8px;text-align:right;">${totals.results.toLocaleString()}</td>
    </tr>
  </table>
  ${narrative?.highlights?.length ? `<h3 style="margin-bottom:6px;">Highlights</h3><ul style="margin-top:0;padding-left:20px;">${list(narrative.highlights)}</ul>` : ''}
  ${narrative?.watchouts?.length ? `<h3 style="margin-bottom:6px;">Keeping an eye on</h3><ul style="margin-top:0;padding-left:20px;">${list(narrative.watchouts)}</ul>` : ''}
  <p style="color:#999;font-size:12px;margin-top:24px;">Sent by CanopyStudio.</p>
</div>`;
}

/** test_prompt — Phase-0 plumbing check. Exercises the full pipeline
 * (settings lookup, skills injection, collaboration chaining, JSON
 * parsing, usage rows) with a trivial marketing prompt. */
const testPrompt: SpecBuilder = async (service, job) => {
  const skills = await loadSkills(service, job.workspace_id, 'test_prompt');
  const subject = (job.input?.prompt as string | undefined) ||
    'a neighborhood coffee shop launching oat-milk lattes';
  return {
    system: systemPromptWithSkills(skills),
    user: `Write one punchy ad headline (max 30 characters) and one supporting sentence for: ${subject}.

Return valid JSON: { "headline": "...", "sentence": "..." }`,
    reviewInstructions:
      'Check the headline is 30 characters or fewer, that the copy is specific rather than generic, and that it follows any workspace guidelines in the system prompt.',
    json: true,
  };
};

const BUILDERS: Record<string, SpecBuilder> = {
  test_prompt: testPrompt,
  copy_generation: copyGeneration,
  creative_directions: creativeDirections,
  expand_content: expandContent,
  regenerate_single: regenerateSingle,
  website_analysis: websiteAnalysis,
  competitor_analysis: competitorAnalysis,
  account_analysis: accountAnalysis,
  send_report: sendReport,
};

export function getSpecBuilder(type: string): SpecBuilder | null {
  return BUILDERS[type] ?? null;
}

export function isKnownJobType(type: string): boolean {
  return !!BUILDERS[type];
}

/** Which ai_settings row governs a job type. Usually 1:1; send_report
 * uses the 'report_summary' settings (the LLM part of a report is the
 * narrative — sending isn't an AI mode). */
export function settingsTaskFor(type: string): string {
  return type === 'send_report' ? 'report_summary' : type;
}
