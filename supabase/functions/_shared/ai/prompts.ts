// Prompt library — verbatim port of Swimm-Copywriting-API
// server/services/prompts.js (the donor app's generation quality lives in
// these strings; do not "improve" the wording casually) plus the
// collaboration review/refinement prompts from its collaboration.js.
//
// One addition over the donor: skillsBlock() appends the workspace's
// enabled skills (DB-backed prompt modules) to the system prompt as
// "LEARNED GUIDELINE" sections.

export const SYSTEM_PROMPT = `You are an elite marketing copywriter and digital advertising strategist with deep expertise in Google Ads and META (Facebook/Instagram) platforms.

## YOUR EXPERTISE

### Platform Mastery
- **Google Ads**: Search intent optimization, keyword strategy, Quality Score factors, responsive search ads, Performance Max campaigns, auction dynamics, and search term matching
- **META Advertising**: Scroll-stopping creative, thumb-stopping hooks, storytelling in feed, carousel strategies, Advantage+ optimization, and algorithm-friendly copy structures
- **Cross-Platform Strategy**: Understanding when to adapt messaging vs. create platform-native content

### Copywriting Excellence
- Writing conversion-focused copy that respects character limits with ZERO tolerance for exceeds
- Crafting headlines that trigger curiosity, urgency, or emotional resonance within strict constraints
- Creating descriptions that address pain points, highlight benefits, and drive specific actions
- Building keyword strategies that capture high-intent searches and relevant audience segments
- Developing audience signals that reach the right people through interests, behaviors, and demographics

### Brand Voice Interpretation
- Translating brand guidelines into authentic, on-brand advertising copy
- Maintaining consistency across all ad variations while maximizing variety
- Adapting tone for different campaign goals (awareness, consideration, conversion)
- Respecting brand do's and don'ts as non-negotiable constraints

### Multi-Location & Franchise Expertise
- Understanding how parent brand guidelines apply to individual locations
- Localizing copy while maintaining brand consistency
- Balancing corporate messaging with location-specific offers and details
- Incorporating local market nuances without violating brand standards

## CRITICAL RULES

1. **CHARACTER LIMITS ARE ABSOLUTE** - Never exceed them. Count carefully. When in doubt, be shorter.
2. **BRAND GUIDELINES ARE LAW** - If the client says "don't use X," never use X. If they say "always include Y," include Y.
3. **PARENT BRAND FIRST** - For child locations, parent brand guidelines take precedence unless explicitly overridden by the location
4. **BENEFITS OVER FEATURES** - Focus on what the customer gains, not what the product has
5. **VARIETY IS ESSENTIAL** - Each headline, description, and ad variation must be meaningfully different
6. **ASSET INSIGHTS MATTER** - When brand assets are analyzed, use those insights to inform your copy
7. **CALL-TO-ACTION CLARITY** - Every piece of copy should guide the user toward a specific action
8. **MATCH THE VOICE** - Your copy should sound like the brand, not like an AI wrote it`;

// Collaboration prompts (from the donor's collaboration.js).
export const REVIEW_SYSTEM_PROMPT = `You are a senior marketing strategist reviewing advertising copy created by another AI. Your role is to:

1. **Identify Strengths**: What works well in the current output?
2. **Spot Weaknesses**: What could be improved? (character limits, variety, brand alignment, etc.)
3. **Suggest Specific Improvements**: Give concrete, actionable feedback
4. **Check Compliance**: Ensure character limits are respected, brand guidelines are followed

Be constructive but thorough. Your feedback will be used to create a refined final version.`;

export const REFINEMENT_SYSTEM_PROMPT = `You are refining advertising copy based on peer review feedback.

IMPORTANT RULES:
1. Incorporate ALL valid feedback from the review
2. Keep what was praised - don't change things that work
3. Fix ALL issues mentioned (character limits, variety, brand voice, etc.)
4. Maintain the same JSON output structure
5. Character limits are ABSOLUTE - count carefully

Return the complete refined output in the same JSON format as the original.`;

/** Brand context shape shared by prompts. Field names intentionally match
 * the donor app's clients table so the prompt strings stay verbatim. */
export interface BrandContext {
  name: string;
  company_description?: string | null;
  customer_avatars?: string | null;
  brand_voice?: string | null;
  dos?: string | null;
  donts?: string | null;
  additional_notes?: string | null;
}

export interface CampaignContext {
  name: string;
  goal?: string | null;
  medium?: string | null;
  campaign_context?: string | null;
}

export interface CreativeDirection {
  id?: number;
  title: string;
  hook: string;
  description: string;
  themes: string[];
}

export interface Skill {
  name: string;
  content: string;
}

/** DB-backed skills → system-prompt suffix. */
export function skillsBlock(skills: Skill[]): string {
  if (!skills.length) return '';
  const blocks = skills
    .map((s) => `## LEARNED GUIDELINE: ${s.name}\n${s.content.trim()}`)
    .join('\n\n');
  return `\n\n# WORKSPACE LEARNED GUIDELINES
The following guidelines were curated by this workspace's team. Treat them
as standing instructions that apply on top of everything above.

${blocks}`;
}

export function systemPromptWithSkills(skills: Skill[]): string {
  return SYSTEM_PROMPT + skillsBlock(skills);
}

// Helper to format dos and donts for prompts
export function formatGuidelines(client: BrandContext): string {
  const dos = client.dos || '';
  const donts = client.donts || '';
  if (dos || donts) {
    let guidelines = '';
    if (dos) guidelines += `DO's (things to include): ${dos}`;
    if (donts) guidelines += `${dos ? '\n' : ''}DON'Ts (things to avoid): ${donts}`;
    return guidelines || 'None specified';
  }
  return 'None specified';
}

// Format parent/child client context
export function formatClientContext(
  client: BrandContext,
  parentClient: BrandContext | null = null,
): string {
  if (parentClient) {
    return `## PARENT BRAND CONTEXT
**IMPORTANT**: This campaign is for a specific location/franchise of a larger brand. The parent brand guidelines below establish the foundational brand identity that MUST be respected. Location-specific details can supplement but not contradict the parent brand.

**Parent Brand Name**: ${parentClient.name}
**Parent Company Description**: ${parentClient.company_description || 'Not provided'}
**Parent Target Audience**: ${parentClient.customer_avatars || 'Not provided'}
**Parent Brand Voice**: ${parentClient.brand_voice || 'Professional and engaging'}
**Parent Guidelines**:
${formatGuidelines(parentClient)}
**Parent Additional Notes**: ${parentClient.additional_notes || 'None'}

---

## LOCATION-SPECIFIC CONTEXT
The following details are specific to this location and should be used to personalize the parent brand messaging:

**Location Name**: ${client.name}
**Location Description**: ${client.company_description || 'Uses parent brand description'}
**Location-Specific Audience**: ${client.customer_avatars || 'Uses parent brand audience'}
**Location Voice Adjustments**: ${client.brand_voice || 'Uses parent brand voice'}
**Location-Specific Guidelines**:
${formatGuidelines(client) !== 'None specified' ? formatGuidelines(client) : 'Follows parent brand guidelines'}
**Location Notes**: ${client.additional_notes || 'None'}`;
  }

  return `## CLIENT CONTEXT
**Company Name**: ${client.name}
**Company Description**: ${client.company_description || 'Not provided'}
**Target Audience**: ${client.customer_avatars || 'Not provided'}
**Brand Voice**: ${client.brand_voice || 'Professional and engaging'}
**Guidelines**:
${formatGuidelines(client)}
**Additional Notes**: ${client.additional_notes || 'None'}`;
}

/** Landing-page / scraped-content section. Canopy feeds scraped website
 * text here instead of the donor's uploaded-asset analyses. */
export function formatSourceContent(label: string, content: string): string {
  if (!content.trim()) return '';
  return `## ${label}
The following content was extracted from the client's website / landing page. Use it to ground the copy in real offers, products, and language the brand actually uses.

${content.trim()}`;
}

const COPY_OUTPUT_REQUIREMENTS = (keywordRange: string) => `## OUTPUT REQUIREMENTS
Generate advertising copy following these EXACT specifications.

FOR GOOGLE ADS:
1. Keywords List - Generate ${keywordRange} relevant keywords for targeting
2. 15 Headlines - Each must be EXACTLY 30 characters or less (count carefully!)
3. 10 Descriptions - Each must be EXACTLY 90 characters or less (count carefully!)
4. **50 Audience Signals** - You MUST generate EXACTLY 50 signals (not 30, not 40, EXACTLY 50). Count them before responding. Include: keywords from the list above, synonyms, related phrases, long-tail variations, competitor terms, pain point phrases, benefit phrases, demographic interests, and behavioral signals.

FOR META (Facebook/Instagram):
1. 5 Primary Text options - These are the main ad copy. IMPORTANT LENGTH REQUIREMENTS:
   - At least 2 of the 5 MUST be multi-paragraph (2-3 short paragraphs with line breaks)
   - These longer ones should tell a story, address pain points, and include a clear CTA
   - The other 3 can be shorter (1-2 sentences) for variety
2. 5 Headlines - Each must be EXACTLY 25 characters or less (count carefully!)

IMPORTANT: Return your response as valid JSON with this exact structure:
{
  "google_ads": {
    "keywords": ["keyword1", "keyword2", ...],
    "headlines": ["Headline 1", "Headline 2", ...],
    "descriptions": ["Description 1", "Description 2", ...],
    "signals": ["signal1", "signal2", ...]
  },
  "meta": {
    "primary_text": ["Short text 1", "Multi-paragraph text with\\n\\nline breaks between paragraphs", ...],
    "headlines": ["Headline 1", "Headline 2", ...]
  }
}

CRITICAL REMINDERS:
- Double-check all character counts - every headline and description MUST be within limits
- **SIGNALS: COUNT THEM! You must have EXACTLY 50 items in the signals array. Not 30, not 49, EXACTLY 50.**
- Use \\n\\n for paragraph breaks in multi-paragraph primary texts`;

export function buildUserPrompt(
  client: BrandContext,
  campaign: CampaignContext,
  additionalContext = '',
  sourceContent = '',
  parentClient: BrandContext | null = null,
): string {
  const clientContext = formatClientContext(client, parentClient);
  const sourceSection = formatSourceContent('LANDING PAGE / WEBSITE CONTENT', sourceContent);

  return `${clientContext}

## CAMPAIGN DETAILS
**Campaign Name**: ${campaign.name}
**Goal**: ${campaign.goal || 'General awareness and conversions'}
**Platform(s)**: ${campaign.medium || 'BOTH'}
**Campaign Context**: ${campaign.campaign_context || 'None provided'}

${sourceSection}

## ADDITIONAL CONTEXT FROM USER
${additionalContext || 'None provided'}

${COPY_OUTPUT_REQUIREMENTS('30-80')}`;
}

export function buildUserPromptWithDirection(
  client: BrandContext,
  campaign: CampaignContext,
  additionalContext = '',
  selectedDirection: CreativeDirection | null = null,
  sourceContent = '',
  parentClient: BrandContext | null = null,
): string {
  let directionContext = '';
  if (selectedDirection) {
    directionContext = `
## SELECTED CREATIVE DIRECTION
**Title**: ${selectedDirection.title}
**Hook**: ${selectedDirection.hook}
**Approach**: ${selectedDirection.description}
**Key Themes to Emphasize**: ${selectedDirection.themes.join(', ')}

**IMPORTANT**: All generated copy MUST align with this creative direction. Use the themes and approach described above as the foundation for all headlines, descriptions, and ad copy. The creative direction should work in harmony with the brand guidelines - never contradict them.
`;
  }

  const clientContext = formatClientContext(client, parentClient);
  const sourceSection = formatSourceContent('LANDING PAGE / WEBSITE CONTENT', sourceContent);

  return `${clientContext}

## CAMPAIGN DETAILS
**Campaign Name**: ${campaign.name}
**Goal**: ${campaign.goal || 'General awareness and conversions'}
**Platform(s)**: ${campaign.medium || 'BOTH'}
**Campaign Context**: ${campaign.campaign_context || 'None provided'}
${directionContext}
${sourceSection}

## ADDITIONAL CONTEXT FROM USER
${additionalContext || 'None provided'}

${COPY_OUTPUT_REQUIREMENTS('20-30')}`;
}

export function buildCreativeDirectionsPrompt(
  client: BrandContext,
  campaign: CampaignContext,
  adjustments = '',
  sourceContent = '',
  parentClient: BrandContext | null = null,
): string {
  const clientContext = formatClientContext(client, parentClient);
  const sourceSection = formatSourceContent('LANDING PAGE / WEBSITE CONTENT', sourceContent);

  return `${clientContext}

## CAMPAIGN DETAILS
**Campaign Name**: ${campaign.name}
**Goal**: ${campaign.goal || 'General awareness and conversions'}
**Platform(s)**: ${campaign.medium || 'BOTH'}
**Campaign Context**: ${campaign.campaign_context || 'None provided'}

${sourceSection}

${adjustments ? `## USER FEEDBACK/ADJUSTMENTS\n${adjustments}\n` : ''}
## TASK
Generate 3 distinct creative direction ideas for this advertising campaign. Each direction should offer a unique angle, messaging approach, or creative concept that could resonate with the target audience.

For each direction, provide:
1. A short, catchy title (3-5 words)
2. A one-sentence hook that captures the core idea
3. A brief description (2-3 sentences) explaining the creative approach and why it would work
4. 3 example themes or key messages that would be used in this direction

Return your response as valid JSON with this exact structure:
{
  "directions": [
    {
      "id": 1,
      "title": "Direction Title Here",
      "hook": "The one-line hook that captures the essence",
      "description": "2-3 sentences explaining this creative approach and why it resonates with the target audience.",
      "themes": ["Theme 1", "Theme 2", "Theme 3"]
    },
    {
      "id": 2,
      "title": "...",
      "hook": "...",
      "description": "...",
      "themes": ["...", "...", "..."]
    },
    {
      "id": 3,
      "title": "...",
      "hook": "...",
      "description": "...",
      "themes": ["...", "...", "..."]
    }
  ]
}

Make each direction meaningfully different - vary the emotional appeal, messaging angle, or creative concept. Consider approaches like:
- Problem/solution focused
- Aspirational/lifestyle focused
- Social proof/trust building
- Urgency/scarcity driven
- Educational/informative
- Emotional storytelling
- Benefit-led
- Feature comparison`;
}
