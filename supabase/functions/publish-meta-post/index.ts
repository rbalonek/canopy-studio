// publish-meta-post
//
// Publishes ONE organic content_posts row to Meta, LIVE, right now — the
// "post it now" button in the Content Calendar. Unlike publish-meta-ad
// (which makes always-PAUSED paid objects), organic posts have no paused
// state, so this is gated to APPROVED posts and is a deliberate, confirmed
// one-time action.
//
// Channels (from the post row), each an independent Graph call:
//   - facebook: POST /{page_id}/photos (with image) or /{page_id}/feed
//     (text only). Needs a PAGE access token — we exchange the configured
//     user/system-user token for one via GET /{page_id}?fields=access_token.
//   - instagram: two-step POST /{ig_user_id}/media (image_url + caption)
//     → POST /{ig_user_id}/media_publish. IG REQUIRES an image.
//
// Per-platform captions (caption_fb / caption_ig) are used independently.
// A partial result (FB ok, IG fails) is recorded, never silently retried:
// the post is marked 'failed' with an error naming what did and didn't go
// out, so the user doesn't blindly re-publish and double-post FB.
//
// Requirements: a Meta token for the client (same resolution as the ad
// publisher), a Facebook Page ID, and — for IG — an Instagram Business
// account id, both configured on the client's Ad Accounts tab. External
// client accounts need Advanced Access + App Review
// (pages_manage_posts, instagram_business_content_publish); a System User
// token on your own Business Manager works without review.

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import { authenticate, serviceClient } from '../_shared/auth.ts';

const META_GRAPH = 'https://graph.facebook.com/v18.0';

interface PublishRequest {
  content_post_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as PublishRequest;
    if (!body?.content_post_id) {
      return json({ ok: false, error: 'content_post_id is required' }, 400);
    }

    const caller = await authenticate(req);
    if (!caller) return json({ ok: false, error: 'Invalid session' }, 401);

    // RLS gate: the post is only visible to workspace members.
    const { data: post } = await caller.userClient
      .from('content_posts')
      .select(
        'id, workspace_id, client_id, location_id, channels, format, topic, caption_fb, caption_ig, image_url, status',
      )
      .eq('id', body.content_post_id)
      .maybeSingle();
    if (!post) return json({ ok: false, error: 'Post not found or access denied' }, 403);

    // Only approved posts publish — never a draft.
    if (post.status !== 'approved') {
      return json(
        { ok: false, error: `Post must be approved before publishing (currently "${post.status}")` },
        400,
      );
    }

    const channels: string[] = Array.isArray(post.channels) ? post.channels : [];
    const wantFb = channels.includes('facebook');
    const wantIg = channels.includes('instagram');
    if (!wantFb && !wantIg) {
      return json({ ok: false, error: 'This post has no channels selected' }, 400);
    }
    // IG hard requirement: an image. Text-only IG posts don't exist in the API.
    if (wantIg && !post.image_url) {
      return json(
        { ok: false, error: 'Instagram requires an image — add an image URL to the post, or turn Instagram off for now' },
        400,
      );
    }

    const service = serviceClient();

    const userToken = await resolveAccessToken(service, post.workspace_id, post.client_id);
    if (!userToken) {
      return json({ ok: false, error: 'No Meta access token configured (Settings → Connections)' }, 400);
    }
    const targets = await resolveTargets(service, post.client_id, post.location_id);
    if (wantFb && !targets.pageId) {
      return json({ ok: false, error: 'No Facebook Page ID configured for this client (Ad Accounts tab)' }, 400);
    }
    if (wantIg && !targets.igUserId) {
      return json(
        { ok: false, error: 'No Instagram Business account id configured for this client (Ad Accounts tab)' },
        400,
      );
    }

    // Audit row first; ids fill in as each channel lands.
    const { data: pub, error: pubErr } = await service
      .from('post_publishes')
      .insert({
        workspace_id: post.workspace_id,
        client_id: post.client_id,
        content_post_id: post.id,
        page_id: targets.pageId,
        ig_user_id: targets.igUserId,
        channels,
        status: 'publishing',
        created_by: caller.userId,
      })
      .select('id')
      .single();
    if (pubErr || !pub) return json({ ok: false, error: pubErr?.message ?? 'Failed to record publish' }, 500);

    const results: { channel: string; ok: boolean; id?: string; error?: string }[] = [];

    // ---- Facebook ----
    if (wantFb) {
      try {
        // A page post needs a PAGE token, derived from the configured token.
        const pageToken = await getPageToken(targets.pageId!, userToken);
        const message = (post.caption_fb as string | null) ?? '';
        let fbId: string;
        if (post.image_url) {
          const r = await graphPost(`${targets.pageId}/photos`, pageToken, {
            url: post.image_url as string,
            ...(message ? { caption: message } : {}),
          });
          fbId = r.post_id ?? r.id;
        } else {
          const r = await graphPost(`${targets.pageId}/feed`, pageToken, { message });
          fbId = r.id;
        }
        results.push({ channel: 'facebook', ok: true, id: fbId });
        await service.from('post_publishes').update({ fb_post_id: fbId }).eq('id', pub.id);
      } catch (e) {
        results.push({ channel: 'facebook', ok: false, error: (e as Error).message });
      }
    }

    // ---- Instagram (two-step) ----
    if (wantIg) {
      try {
        const container = await graphPost(`${targets.igUserId}/media`, userToken, {
          image_url: post.image_url as string,
          ...(post.caption_ig ? { caption: post.caption_ig as string } : {}),
        });
        const published = await graphPost(`${targets.igUserId}/media_publish`, userToken, {
          creation_id: container.id,
        });
        results.push({ channel: 'instagram', ok: true, id: published.id });
        await service.from('post_publishes').update({ ig_media_id: published.id }).eq('id', pub.id);
      } catch (e) {
        results.push({ channel: 'instagram', ok: false, error: (e as Error).message });
      }
    }

    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    const allOk = failed.length === 0;
    const anyOk = succeeded.length > 0;
    const pubStatus = allOk ? 'published' : anyOk ? 'partial' : 'failed';
    const errorText = failed.length
      ? failed.map((r) => `${r.channel}: ${r.error}`).join('; ') +
        (anyOk ? ` (succeeded: ${succeeded.map((r) => r.channel).join(', ')})` : '')
      : null;
    const now = new Date().toISOString();

    await service
      .from('post_publishes')
      .update({ status: pubStatus, error: errorText, published_at: anyOk ? now : null })
      .eq('id', pub.id);

    // Mirror onto the post row: published only when every channel went out;
    // otherwise failed with the detail, so a retry is a conscious choice.
    await service
      .from('content_posts')
      .update({
        status: allOk ? 'published' : 'failed',
        published_at: anyOk ? now : null,
        publish_error: errorText,
        updated_at: now,
      })
      .eq('id', post.id);

    return json(
      {
        ok: anyOk,
        publish_id: pub.id,
        status: pubStatus,
        results,
        error: errorText,
      },
      anyOk ? 200 : 502,
    );
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

/** Exchange the configured user/system-user token for a Page access token
 * (required to post to a Page feed). System-user tokens often return
 * themselves here; a user token returns the page-scoped token. */
async function getPageToken(pageId: string, userToken: string): Promise<string> {
  const url = `${META_GRAPH}/${pageId}?fields=access_token&access_token=${encodeURIComponent(userToken)}`;
  const resp = await fetch(url);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error || !data.access_token) {
    // Fall back to the configured token — a System User token can post to
    // pages it manages directly.
    return userToken;
  }
  return data.access_token as string;
}

async function graphPost(
  path: string,
  accessToken: string,
  params: Record<string, string>,
): Promise<any> {
  const bodyParams = new URLSearchParams({ ...params, access_token: accessToken });
  const resp = await fetch(`${META_GRAPH}/${path}`, { method: 'POST', body: bodyParams });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) {
    const err = data.error ?? {};
    throw new Error(
      `Meta /${path} failed: ${err.message ?? resp.statusText}${
        err.error_user_msg ? ` — ${err.error_user_msg}` : ''
      }`,
    );
  }
  return data;
}

async function resolveAccessToken(
  service: ReturnType<typeof serviceClient>,
  workspaceId: string,
  clientId: string,
): Promise<string | null> {
  const { data: clientCreds } = await service
    .from('client_meta_credentials')
    .select('access_token')
    .eq('client_id', clientId)
    .maybeSingle();
  if (clientCreds?.access_token) return clientCreds.access_token as string;
  const { data: ws } = await service
    .from('workspace_meta_credentials')
    .select('access_token')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (ws?.access_token) return ws.access_token as string;
  const { data: legacy } = await service
    .from('meta_accounts')
    .select('access_token')
    .eq('client_id', clientId)
    .maybeSingle();
  return (legacy?.access_token as string | undefined) ?? null;
}

/** Resolve the Facebook Page + Instagram Business account for this post.
 * Location-scoped posts use that location's identities; otherwise the
 * legacy per-client meta_accounts row. */
async function resolveTargets(
  service: ReturnType<typeof serviceClient>,
  clientId: string,
  locationId: string | null,
): Promise<{ pageId: string | null; igUserId: string | null }> {
  if (locationId) {
    const { data: loc } = await service
      .from('locations')
      .select('page_id, instagram_business_account_id')
      .eq('id', locationId)
      .maybeSingle();
    if (loc?.page_id || loc?.instagram_business_account_id) {
      return {
        pageId: (loc.page_id as string | null) ?? null,
        igUserId: (loc.instagram_business_account_id as string | null) ?? null,
      };
    }
  }
  const { data: legacy } = await service
    .from('meta_accounts')
    .select('page_id, instagram_business_account_id')
    .eq('client_id', clientId)
    .maybeSingle();
  return {
    pageId: (legacy?.page_id as string | null) ?? null,
    igUserId: (legacy?.instagram_business_account_id as string | null) ?? null,
  };
}
