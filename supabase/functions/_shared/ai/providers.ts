// Provider adapters: one uniform contract over Anthropic and OpenAI.
//
// This replaces the donor app's three duck-typed service modules + the
// normalizeProvider/getProviderService switch duplicated across its
// routes. Raw fetch instead of the SDKs: both APIs are a single POST,
// and skipping the SDKs keeps the Deno bundle tiny and dependency-free.
//
// Which provider/model runs a given task is decided by ai_settings rows
// (see orchestrator.ts) — never hardcoded here. The DEFAULT_MODELS below
// are only the seed fallback when a workspace hasn't configured a task.

export type Provider = 'anthropic' | 'openai';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface LlmResult {
  text: string;
  usage: LlmUsage;
  provider: Provider;
  model: string;
}

export interface LlmOptions {
  maxTokens?: number;
  temperature?: number;
  /** Ask for a JSON object response. OpenAI: native json_object mode.
   * Anthropic: no native mode — callers run extractJson() on the text. */
  jsonMode?: boolean;
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-4o',
};

const DEFAULT_MAX_TOKENS = 8000;

export async function callLlm(
  provider: Provider,
  model: string | null | undefined,
  messages: LlmMessage[],
  options: LlmOptions = {},
): Promise<LlmResult> {
  const resolvedModel = model || DEFAULT_MODELS[provider];
  if (provider === 'anthropic') {
    return await callAnthropic(resolvedModel, messages, options);
  }
  return await callOpenAi(resolvedModel, messages, options);
}

async function callAnthropic(
  model: string,
  messages: LlmMessage[],
  options: LlmOptions,
): Promise<LlmResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const chat = messages.filter((m) => m.role !== 'system');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(system ? { system } : {}),
      messages: chat.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!resp.ok) {
    const detail = await safeErrorDetail(resp);
    throw new Error(`Anthropic API error (${resp.status}): ${detail}`);
  }

  // deno-lint-ignore no-explicit-any
  const data = (await resp.json()) as any;
  const text = (data.content ?? [])
    // deno-lint-ignore no-explicit-any
    .filter((b: any) => b.type === 'text')
    // deno-lint-ignore no-explicit-any
    .map((b: any) => b.text)
    .join('');

  return {
    text,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
    provider: 'anthropic',
    model,
  };
}

async function callOpenAi(
  model: string,
  messages: LlmMessage[],
  options: LlmOptions,
): Promise<LlmResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!resp.ok) {
    const detail = await safeErrorDetail(resp);
    throw new Error(`OpenAI API error (${resp.status}): ${detail}`);
  }

  // deno-lint-ignore no-explicit-any
  const data = (await resp.json()) as any;
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
    provider: 'openai',
    model,
  };
}

async function safeErrorDetail(resp: Response): Promise<string> {
  try {
    const body = await resp.text();
    return body.slice(0, 500);
  } catch {
    return resp.statusText;
  }
}

/** Extract a JSON object from an LLM response that may wrap it in prose
 * or markdown fences. Ported from the donor app's extractJson. */
// deno-lint-ignore no-explicit-any
export function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch (_e) {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) return JSON.parse(fence[1].trim());
    const object = text.match(/\{[\s\S]*\}/);
    if (object) return JSON.parse(object[0]);
    throw new Error('No JSON object found in model response');
  }
}
