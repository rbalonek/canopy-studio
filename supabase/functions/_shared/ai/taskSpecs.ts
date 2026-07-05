// Task registry: maps a job's `type` to the prompts the orchestrator
// should run. Each builder loads whatever context it needs (brand
// profile, scraped pages, landing page) with the service client and
// returns an OrchestratedPromptSpec. Adding an AI capability = adding a
// builder here.

// deno-lint-ignore-file no-explicit-any
import type { ServiceClient } from '../auth.ts';
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
      .order('word_count', { ascending: false })
      .limit(12),
    service
      .from('scraped_domains')
      .select('domain, raw_palette, raw_fonts, logo_url')
      .eq('client_id', clientId)
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
};

export function getSpecBuilder(type: string): SpecBuilder | null {
  return BUILDERS[type] ?? null;
}

export function isKnownJobType(type: string): boolean {
  return !!BUILDERS[type];
}
