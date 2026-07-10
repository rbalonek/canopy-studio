// Shared bits for the Settings tabs.

import type React from 'react';

export const inputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
  padding: '10px 12px',
  font: 'inherit',
};

/** AI task ids ↔ human labels. Must stay in sync with the ai_settings
 * task check constraint and the Edge Function task registry. */
export const AI_TASKS: Array<{ id: string; label: string; hint: string }> = [
  {
    id: 'copy_generation',
    label: 'Copy generation',
    hint: 'Google + META ad copy from a campaign brief',
  },
  {
    id: 'creative_directions',
    label: 'Creative directions',
    hint: 'The 3 concept angles offered before generating',
  },
  {
    id: 'expand_content',
    label: 'Add more with AI',
    hint: 'Extending keywords / headlines / signals lists',
  },
  {
    id: 'regenerate_single',
    label: 'Regenerate single item',
    hint: 'Rewriting one headline or description',
  },
  {
    id: 'website_analysis',
    label: 'Website analysis',
    hint: 'Turning scraped pages into a brand profile',
  },
  {
    id: 'location_detection',
    label: 'Location detection',
    hint: 'Spotting per-location pages on a scraped site',
  },
  {
    id: 'competitor_analysis',
    label: 'Competitor analysis',
    hint: 'Comparisons and gap angles from competitor sites',
  },
  {
    id: 'account_analysis',
    label: 'Account analysis',
    hint: 'Campaign performance review and suggestions',
  },
  {
    id: 'report_summary',
    label: 'Report narratives',
    hint: 'The written summary in client reports',
  },
  {
    id: 'content_plan',
    label: 'Content plans',
    hint: 'Planning a calendar of social posts (topics, captions, image briefs)',
  },
];

export const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'openai', label: 'OpenAI (GPT)' },
] as const;

export const MODES = [
  { id: 'anthropic', label: 'Anthropic only' },
  { id: 'openai', label: 'OpenAI only' },
  { id: 'collaboration', label: 'Collaboration (generate → review → refine)' },
] as const;

/** Image generation is provider-pluggable like everything else — the
 * choice is an ai_settings row (task 'image_generation'), never code.
 * xAI is the default preset. */
export const IMAGE_PROVIDERS = [
  { id: 'xai', label: 'xAI (Grok)', modelPlaceholder: 'grok-imagine-image' },
  { id: 'openai', label: 'OpenAI', modelPlaceholder: 'gpt-image-1' },
] as const;

export const DEFAULT_IMAGE_PROVIDER = 'xai';
