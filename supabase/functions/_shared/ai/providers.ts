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

// Hard ceiling on a single provider round-trip. Without it a hung provider
// (connection accepted, no response) makes run-job's processStep never
// return; the isolate is then killed at the platform wall-clock cap before
// the catch that marks the job failed can run, stranding the job in
// 'processing' forever. Abort well inside that cap so the failure is caught.
const LLM_TIMEOUT_MS = 90_000;

async function fetchLlm(url: string, init: RequestInit, ms = LLM_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error(`LLM request timed out after ${ms}ms`);
    }
    throw e;
  } finally {
    clearTimeout(id);
  }
}

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

  const resp = await fetchLlm('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      // NB: temperature/top_p/top_k are intentionally NOT sent. The current
      // Anthropic models (Sonnet 5, Opus 4.7/4.8, Fable 5 — our default is
      // claude-sonnet-5) removed the sampling params and return HTTP 400
      // ("temperature is deprecated for this model") if any are present.
      // Task specs may still set options.temperature for the OpenAI path,
      // which continues to honor it. Steer Anthropic via prompting instead.
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

  const resp = await fetchLlm('https://api.openai.com/v1/chat/completions', {
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
 * or markdown fences. Ported from the donor app's extractJson, extended
 * with a deterministic repair pass: models occasionally emit *malformed*
 * JSON — an unescaped quote inside ad copy (`"hook": "a "wow" moment"`),
 * raw newlines inside strings, trailing commas, or a truncated tail —
 * and one bad character used to fail the whole generation job. Every
 * candidate is tried verbatim first; repair only runs when strict
 * parsing has already failed, so well-formed output is never altered. */
// deno-lint-ignore no-explicit-any
export function extractJson(text: string): any {
  const candidates: string[] = [text];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());
  const object = text.match(/\{[\s\S]*\}/);
  if (object) candidates.push(object[0]);

  let lastErr: unknown = null;
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch (e) {
      lastErr = e;
    }
  }
  for (const c of candidates) {
    try {
      return JSON.parse(repairJson(c));
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Model returned unparseable JSON (${(lastErr as Error | null)?.message ?? 'no JSON object found'})`,
  );
}

/** Best-effort mechanical repair of almost-JSON. Walks the text with a
 * tiny string-state scanner:
 *  - a `"` inside a string closes it only when the next non-space char
 *    can legally follow a string (`,` `}` `]` `:` or end) — otherwise
 *    it's an unescaped inner quote and gets escaped;
 *  - raw newlines/tabs inside strings become their escapes;
 *  - an unterminated string and any unclosed braces/brackets are closed
 *    (truncated responses);
 *  - trailing commas before `}`/`]` are dropped.
 * Heuristic by design — it makes typical model slips parseable, not
 * arbitrary garbage valid. */
function repairJson(src: string): string {
  let out = '';
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) {
        out += ch;
        esc = false;
        continue;
      }
      if (ch === '\\') {
        out += ch;
        esc = true;
        continue;
      }
      if (ch === '\n') {
        out += '\\n';
        continue;
      }
      if (ch === '\r') continue;
      if (ch === '\t') {
        out += '\\t';
        continue;
      }
      if (ch === '"') {
        let j = i + 1;
        while (j < src.length && /\s/.test(src[j])) j++;
        const next = src[j];
        // A quote followed by a comma is only a real string end when what
        // comes after the comma can start a JSON value/key ("Say "yes",
        // then smile" must stay one string).
        let closes = next === undefined || next === '}' || next === ']' || next === ':';
        if (next === ',') {
          let k = j + 1;
          while (k < src.length && /\s/.test(src[k])) k++;
          const c2 = src[k];
          closes =
            c2 === undefined ||
            c2 === '"' ||
            c2 === '{' ||
            c2 === '[' ||
            c2 === '-' ||
            (c2 >= '0' && c2 <= '9') ||
            src.startsWith('true', k) ||
            src.startsWith('false', k) ||
            src.startsWith('null', k);
        }
        if (closes) {
          inStr = false;
          out += ch;
        } else {
          out += '\\"';
        }
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch === '{' ? '}' : ']');
      out += ch;
      continue;
    }
    if (ch === '}' || ch === ']') {
      if (stack[stack.length - 1] === ch) stack.pop();
      out += ch;
      continue;
    }
    out += ch;
  }
  if (inStr) out += '"';
  while (stack.length) out += stack.pop();
  return out.replace(/,\s*([}\]])/g, '$1');
}
