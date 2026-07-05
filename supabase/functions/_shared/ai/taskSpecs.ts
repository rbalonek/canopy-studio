// Task registry: maps a job's `type` to the prompts the orchestrator
// should run. Each builder loads whatever context it needs (brand
// profile, scraped pages, …) with the service client and returns an
// OrchestratedPromptSpec. Adding an AI capability = adding a builder.

import type { ServiceClient } from '../auth.ts';
import type { OrchestratedPromptSpec } from './orchestrator.ts';
import { loadSkills } from './orchestrator.ts';
import { systemPromptWithSkills } from './prompts.ts';

export interface JobRow {
  id: string;
  workspace_id: string;
  client_id: string | null;
  type: string;
  // deno-lint-ignore no-explicit-any
  input: any;
}

export type SpecBuilder = (
  service: ServiceClient,
  job: JobRow,
) => Promise<OrchestratedPromptSpec>;

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
};

export function getSpecBuilder(type: string): SpecBuilder | null {
  return BUILDERS[type] ?? null;
}

export function isKnownJobType(type: string): boolean {
  return !!BUILDERS[type];
}
