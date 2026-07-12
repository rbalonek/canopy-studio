// generate-post-image
//
// Turns a content post's image brief (image_prompt) into an actual image:
// calls the workspace's configured image provider, stores the result in the
// public client-assets bucket (same bucket the asset library uses, so the
// URL is stable and Meta-publishable), and sets content_posts.image_url.
//
// Provider is DATA, not code: the ai_settings row for task
// 'image_generation' picks xai (default) or openai plus a free-text model.
// Secrets: XAI_API_KEY / OPENAI_API_KEY.
//
// Direct browser-invoked function (like scrape-client), not a jobs-pipeline
// task — the pipeline is built around one *chat* call per invocation and an
// image generation is a different shape; a 5–20s synchronous call fits the
// function budget fine.

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import { authenticate, serviceClient } from '../_shared/auth.ts';
import { loadWorkspaceKeys } from '../_shared/ai/orchestrator.ts';
import { billingBlockReason, recordImageUsage } from '../_shared/ai/usage.ts';

interface GenerateRequest {
  content_post_id: string;
  /** Optional override; defaults to the post's stored image_prompt. */
  prompt?: string;
}

// xAI retired grok-2-image (mid-2026) for the grok-imagine family —
// 'grok-imagine-image' (fast) / 'grok-imagine-image-quality' (better).
// These are only fallbacks: the ai_settings row's free-text model wins.
const DEFAULT_MODELS: Record<string, string> = {
  xai: 'grok-imagine-image',
  openai: 'gpt-image-1',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as GenerateRequest;
    if (!body?.content_post_id) {
      return json({ ok: false, error: 'content_post_id is required' }, 400);
    }

    const caller = await authenticate(req);
    if (!caller) return json({ ok: false, error: 'Invalid session' }, 401);

    // RLS gate: visible only to workspace members.
    const { data: post } = await caller.userClient
      .from('content_posts')
      .select('id, workspace_id, client_id, image_prompt')
      .eq('id', body.content_post_id)
      .maybeSingle();
    if (!post) return json({ ok: false, error: 'Post not found or access denied' }, 403);

    const prompt = (body.prompt ?? (post.image_prompt as string | null) ?? '').trim();
    if (!prompt) {
      return json({ ok: false, error: 'This post has no image brief — write one first' }, 400);
    }

    const service = serviceClient();

    // Billing gate — same 402 semantics as enqueue-job.
    const blocked = await billingBlockReason(service, post.workspace_id as string);
    if (blocked) return json({ ok: false, error: blocked }, 402);

    // Which provider/model: the image_generation ai_settings row; xAI default.
    const { data: settings } = await service
      .from('ai_settings')
      .select('primary_provider, primary_model')
      .eq('workspace_id', post.workspace_id)
      .eq('task', 'image_generation')
      .maybeSingle();
    const provider = (settings?.primary_provider as string | null) ?? 'xai';
    const model =
      (settings?.primary_model as string | null)?.trim() ||
      DEFAULT_MODELS[provider] ||
      DEFAULT_MODELS.xai;

    // BYO key when the workspace has one for this provider; platform
    // secret otherwise — same resolution as the chat pipeline.
    const keys = await loadWorkspaceKeys(service, post.workspace_id as string);
    const byoKey = provider === 'openai' ? keys.openai : keys.xai;

    const image =
      provider === 'openai'
        ? await openaiImage(prompt, model, byoKey)
        : await xaiImage(prompt, model, byoKey);

    // Meter it (this function recorded nothing before — a billing leak).
    await recordImageUsage(service, {
      workspaceId: post.workspace_id as string,
      provider,
      model,
      keySource: byoKey ? 'workspace' : 'platform',
    });

    // Store in the public client-assets bucket under the post's client, so
    // the URL renders app-wide and can be handed to the Meta publisher.
    const bytes = await imageBytes(image);
    const path = `${post.client_id}/${crypto.randomUUID()}-generated.png`;
    const { error: upErr } = await service.storage
      .from('client-assets')
      .upload(path, bytes, { contentType: 'image/png' });
    if (upErr) return json({ ok: false, error: `Storage upload failed: ${upErr.message}` }, 500);
    const { data: pub } = service.storage.from('client-assets').getPublicUrl(path);
    const imageUrl = pub.publicUrl;

    const { error: updErr } = await service
      .from('content_posts')
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', post.id);
    if (updErr) return json({ ok: false, error: updErr.message }, 500);

    return json({ ok: true, image_url: imageUrl, provider, model });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

/** A provider result: inline base64 or a (temporary) URL to fetch. */
type GeneratedImage = { b64?: string; url?: string };

async function imageBytes(image: GeneratedImage): Promise<Uint8Array> {
  if (image.b64) return Uint8Array.from(atob(image.b64), (c) => c.charCodeAt(0));
  if (image.url) {
    const resp = await fetch(image.url);
    if (!resp.ok) throw new Error(`Could not download the generated image (${resp.status})`);
    return new Uint8Array(await resp.arrayBuffer());
  }
  throw new Error('Provider returned no image data');
}

async function xaiImage(prompt: string, model: string, byoKey?: string): Promise<GeneratedImage> {
  const key = byoKey || Deno.env.get('XAI_API_KEY');
  if (!key) throw new Error('XAI_API_KEY is not configured (Edge Function secrets)');
  const resp = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, n: 1, response_format: 'b64_json' }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`xAI image generation failed: ${(data as any)?.error?.message ?? (data as any)?.error ?? resp.statusText}`);
  }
  const first = (data as any)?.data?.[0] ?? {};
  return { b64: first.b64_json as string | undefined, url: first.url as string | undefined };
}

async function openaiImage(prompt: string, model: string, byoKey?: string): Promise<GeneratedImage> {
  const key = byoKey || Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY is not configured (Edge Function secrets)');
  const resp = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024' }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`OpenAI image generation failed: ${(data as any)?.error?.message ?? resp.statusText}`);
  }
  const first = (data as any)?.data?.[0] ?? {};
  return { b64: first.b64_json as string | undefined, url: first.url as string | undefined };
}
