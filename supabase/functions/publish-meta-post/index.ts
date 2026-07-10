// publish-meta-post
//
// Publishes or schedules ONE organic content_posts row to Meta. Four modes:
//
//   now      (browser) — publish LIVE immediately. Organic posts have no
//            paused state, so this is gated to APPROVED posts behind a
//            confirm in the UI.
//   schedule (browser) — queue for the post's scheduled time (publish_at,
//            an absolute instant computed browser-side). Facebook supports
//            NATIVE scheduling (published=false + scheduled_publish_time):
//            the post appears in Meta's own Content Library → Scheduled tab
//            and Meta publishes it. Instagram's API has no scheduling, so
//            IG goes into pending_channels for the posts_due cron.
//   cancel   (browser) — un-schedule: best-effort delete the FB native
//            scheduled post, clear the queue state, back to approved.
//   due      (internal, cron-dispatch only) — publish pending channels now
//            that publish_at has arrived; FB-native-only rows just flip to
//            published (Meta already did the work).
//
// Channels are independent Graph calls with independent captions:
//   facebook:  /{page_id}/photos | /feed | /videos with a PAGE token
//              (exchanged via /{page_id}?fields=access_token).
//   instagram: two-step /{ig_user_id}/media → media_publish; videos are
//              Reels whose container processes async (status polled).
//   link:      FB only — Instagram has no link posts.
//
// A partial result (FB ok, IG failed) is recorded, never silently retried:
// the post is marked 'failed' with an error naming what DID go out, so the
// user doesn't blindly re-publish and double-post the channel that worked.
//
// Requirements: a Meta token for the client (client_meta_credentials →
// workspace_meta_credentials → meta_accounts), a Facebook Page ID, and —
// for IG — an Instagram Business account id (Ad Accounts tab). External
// client accounts need Advanced Access + App Review (pages_manage_posts,
// instagram_business_content_publish).

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import { authenticate, serviceClient } from '../_shared/auth.ts';
import { isInternalCall } from '../_shared/internal.ts';

const META_GRAPH = 'https://graph.facebook.com/v18.0';
const MIN_SCHEDULE_LEAD_MS = 10 * 60_000 - 30_000; // Meta needs ≥10 min; 30s clock-skew grace

type Mode = 'now' | 'schedule' | 'cancel' | 'due';

interface PublishRequest {
  content_post_id: string;
  mode?: Mode;
  /** ISO instant for mode 'schedule' — computed in the browser so the
   * civil date+time means the scheduler's timezone. */
  publish_at?: string;
}

interface PostRow {
  id: string;
  workspace_id: string;
  client_id: string;
  location_id: string | null;
  channels: string[];
  format: string;
  caption_fb: string | null;
  caption_ig: string | null;
  image_url: string | null;
  media_type: string | null;
  video_url: string | null;
  link_url: string | null;
  status: string;
  publish_at: string | null;
  pending_channels: string[] | null;
  fb_scheduled_post_id: string | null;
}

const POST_COLUMNS =
  'id, workspace_id, client_id, location_id, channels, format, caption_fb, caption_ig, image_url, media_type, video_url, link_url, status, publish_at, pending_channels, fb_scheduled_post_id';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as PublishRequest;
    if (!body?.content_post_id) {
      return json({ ok: false, error: 'content_post_id is required' }, 400);
    }
    const mode: Mode = body.mode ?? 'now';
    const service = serviceClient();

    let post: PostRow | null = null;
    let callerId: string | null = null;

    if (mode === 'due') {
      // Cron path — shared-secret gate, no user in play.
      if (!isInternalCall(req)) return json({ ok: false, error: 'Forbidden' }, 403);
      const { data } = await service
        .from('content_posts')
        .select(POST_COLUMNS)
        .eq('id', body.content_post_id)
        .maybeSingle();
      post = data as PostRow | null;
    } else {
      const caller = await authenticate(req);
      if (!caller) return json({ ok: false, error: 'Invalid session' }, 401);
      callerId = caller.userId;
      // RLS gate: the post is only visible to workspace members.
      const { data } = await caller.userClient
        .from('content_posts')
        .select(POST_COLUMNS)
        .eq('id', body.content_post_id)
        .maybeSingle();
      post = data as PostRow | null;
    }
    if (!post) return json({ ok: false, error: 'Post not found or access denied' }, 403);

    switch (mode) {
      case 'now':
        return await publishNow(service, post, callerId);
      case 'schedule':
        return await schedulePost(service, post, callerId, body.publish_at);
      case 'cancel':
        return await cancelSchedule(service, post);
      case 'due':
        return await publishDue(service, post);
      default:
        return json({ ok: false, error: `Unknown mode: ${mode}` }, 400);
    }
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Validation + target resolution shared by the modes
// ---------------------------------------------------------------------------

interface PublishContext {
  wantFb: boolean;
  wantIg: boolean;
  mediaType: string;
  userToken: string;
  pageId: string | null;
  igUserId: string | null;
}

/** Everything that must hold before ANY channel is touched — one channel
 * must never publish while the other was doomed from the start. Returns a
 * ready context or a { error } to bounce. */
async function prepare(
  service: ReturnType<typeof serviceClient>,
  post: PostRow,
  channels: string[],
): Promise<PublishContext | { error: string }> {
  const wantFb = channels.includes('facebook');
  const wantIg = channels.includes('instagram');
  if (!wantFb && !wantIg) return { error: 'This post has no channels selected' };

  const mediaType = post.media_type ?? 'image';
  if (mediaType === 'video' && !post.video_url) {
    return { error: 'This is a video post but it has no video URL' };
  }
  if (mediaType === 'link' && !post.link_url) {
    return { error: 'This is a link post but it has no link URL' };
  }
  if (mediaType === 'link' && wantIg) {
    return { error: 'Instagram does not support link posts — switch the media type or turn Instagram off' };
  }
  if (mediaType === 'image' && wantIg && !post.image_url) {
    return { error: 'Instagram requires an image — add or generate one, or turn Instagram off for now' };
  }

  const userToken = await resolveAccessToken(service, post.workspace_id, post.client_id);
  if (!userToken) return { error: 'No Meta access token configured (Settings → Connections)' };
  const targets = await resolveTargets(service, post.client_id, post.location_id);
  if (wantFb && !targets.pageId) {
    return { error: 'No Facebook Page ID configured for this client (Ad Accounts tab)' };
  }
  if (wantIg && !targets.igUserId) {
    return { error: 'No Instagram Business account id configured for this client (Ad Accounts tab)' };
  }

  return { wantFb, wantIg, mediaType, userToken, pageId: targets.pageId, igUserId: targets.igUserId };
}

// ---------------------------------------------------------------------------
// Channel publishers
// ---------------------------------------------------------------------------

/** Post to the Facebook Page. scheduledUnix (mode 'schedule') creates a
 * NATIVE scheduled post — unpublished until Meta publishes it at the time,
 * visible in Meta's Content Library → Scheduled. */
async function publishFacebook(
  post: PostRow,
  ctx: PublishContext,
  scheduledUnix?: number,
): Promise<string> {
  const pageToken = await getPageToken(ctx.pageId!, ctx.userToken);
  const message = post.caption_fb ?? '';
  const scheduling = scheduledUnix
    ? { published: 'false', scheduled_publish_time: String(scheduledUnix) }
    : {};
  if (ctx.mediaType === 'video') {
    const r = await graphPost(`${ctx.pageId}/videos`, pageToken, {
      file_url: post.video_url as string,
      ...(message ? { description: message } : {}),
      ...scheduling,
    });
    return r.id as string;
  }
  if (ctx.mediaType === 'link') {
    const r = await graphPost(`${ctx.pageId}/feed`, pageToken, {
      message,
      link: post.link_url as string,
      ...scheduling,
    });
    return r.id as string;
  }
  if (post.image_url) {
    const r = await graphPost(`${ctx.pageId}/photos`, pageToken, {
      url: post.image_url,
      ...(message ? { caption: message } : {}),
      ...scheduling,
    });
    return (r.post_id ?? r.id) as string;
  }
  const r = await graphPost(`${ctx.pageId}/feed`, pageToken, { message, ...scheduling });
  return r.id as string;
}

/** Publish to Instagram immediately (container → media_publish). No native
 * scheduling exists in the IG API — the posts_due cron calls this when the
 * time arrives. */
async function publishInstagram(post: PostRow, ctx: PublishContext): Promise<string> {
  let container: any;
  if (ctx.mediaType === 'video') {
    // IG feed video = Reels. The container processes ASYNC — publishing
    // before it's FINISHED errors, so poll its status (bounded).
    container = await graphPost(`${ctx.igUserId}/media`, ctx.userToken, {
      media_type: 'REELS',
      video_url: post.video_url as string,
      ...(post.caption_ig ? { caption: post.caption_ig } : {}),
    });
    await waitForContainer(container.id as string, ctx.userToken);
  } else {
    container = await graphPost(`${ctx.igUserId}/media`, ctx.userToken, {
      image_url: post.image_url as string,
      ...(post.caption_ig ? { caption: post.caption_ig } : {}),
    });
  }
  const published = await graphPost(`${ctx.igUserId}/media_publish`, ctx.userToken, {
    creation_id: container.id,
  });
  return published.id as string;
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

async function publishNow(
  service: ReturnType<typeof serviceClient>,
  post: PostRow,
  callerId: string | null,
): Promise<Response> {
  if (post.status !== 'approved') {
    return json(
      { ok: false, error: `Post must be approved before publishing (currently "${post.status}")` },
      400,
    );
  }
  const channels = Array.isArray(post.channels) ? post.channels : [];
  const ctx = await prepare(service, post, channels);
  if ('error' in ctx) return json({ ok: false, error: ctx.error }, 400);

  // Audit row first; ids fill in as each channel lands.
  const { data: pub, error: pubErr } = await service
    .from('post_publishes')
    .insert({
      workspace_id: post.workspace_id,
      client_id: post.client_id,
      content_post_id: post.id,
      page_id: ctx.pageId,
      ig_user_id: ctx.igUserId,
      channels,
      status: 'publishing',
      created_by: callerId,
    })
    .select('id')
    .single();
  if (pubErr || !pub) return json({ ok: false, error: pubErr?.message ?? 'Failed to record publish' }, 500);

  const results = await runChannels(service, post, ctx, pub.id as string);

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const allOk = failed.length === 0;
  const anyOk = succeeded.length > 0;
  const errorText = failed.length
    ? failed.map((r) => `${r.channel}: ${r.error}`).join('; ') +
      (anyOk ? ` (succeeded: ${succeeded.map((r) => r.channel).join(', ')})` : '')
    : null;
  const now = new Date().toISOString();

  await service
    .from('post_publishes')
    .update({
      status: allOk ? 'published' : anyOk ? 'partial' : 'failed',
      error: errorText,
      published_at: anyOk ? now : null,
    })
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
    { ok: anyOk, publish_id: pub.id, status: allOk ? 'published' : anyOk ? 'partial' : 'failed', results, error: errorText },
    anyOk ? 200 : 502,
  );
}

async function schedulePost(
  service: ReturnType<typeof serviceClient>,
  post: PostRow,
  callerId: string | null,
  publishAtIso: string | undefined,
): Promise<Response> {
  if (post.status !== 'approved') {
    return json(
      { ok: false, error: `Post must be approved before scheduling (currently "${post.status}")` },
      400,
    );
  }
  const publishAt = publishAtIso ? new Date(publishAtIso) : null;
  if (!publishAt || isNaN(publishAt.getTime())) {
    return json({ ok: false, error: 'publish_at (ISO timestamp) is required to schedule' }, 400);
  }
  if (publishAt.getTime() - Date.now() < MIN_SCHEDULE_LEAD_MS) {
    return json(
      { ok: false, error: 'Scheduled time must be at least 10 minutes from now — use Post now instead' },
      400,
    );
  }

  const channels = Array.isArray(post.channels) ? post.channels : [];
  const ctx = await prepare(service, post, channels);
  if ('error' in ctx) return json({ ok: false, error: ctx.error }, 400);

  // Facebook first — native scheduling. If Meta rejects it (e.g. beyond
  // its max window), nothing has changed and the post stays approved.
  let fbScheduledId: string | null = null;
  if (ctx.wantFb) {
    try {
      fbScheduledId = await publishFacebook(post, ctx, Math.floor(publishAt.getTime() / 1000));
    } catch (e) {
      return json({ ok: false, error: `Facebook scheduling failed: ${(e as Error).message}` }, 502);
    }
  }
  // Instagram can't be scheduled via the API — the posts_due cron publishes
  // it when the time arrives.
  const pending = ctx.wantIg ? ['instagram'] : [];

  const now = new Date().toISOString();
  await service.from('post_publishes').insert({
    workspace_id: post.workspace_id,
    client_id: post.client_id,
    content_post_id: post.id,
    page_id: ctx.pageId,
    ig_user_id: ctx.igUserId,
    channels,
    fb_post_id: fbScheduledId,
    status: 'scheduled',
    created_by: callerId,
  });
  const { error: updErr } = await service
    .from('content_posts')
    .update({
      status: 'scheduled',
      publish_at: publishAt.toISOString(),
      pending_channels: pending,
      fb_scheduled_post_id: fbScheduledId,
      publish_error: null,
      updated_at: now,
    })
    .eq('id', post.id);
  if (updErr) return json({ ok: false, error: updErr.message }, 500);

  return json({
    ok: true,
    status: 'scheduled',
    publish_at: publishAt.toISOString(),
    fb_scheduled_post_id: fbScheduledId,
    note: [
      ctx.wantFb ? "Facebook: in Meta's scheduled queue (visible in Content Library → Scheduled)." : null,
      ctx.wantIg ? 'Instagram: has no API scheduling — CanopyStudio will publish it at the time.' : null,
    ]
      .filter(Boolean)
      .join(' '),
  });
}

async function cancelSchedule(
  service: ReturnType<typeof serviceClient>,
  post: PostRow,
): Promise<Response> {
  if (post.status !== 'scheduled') {
    return json({ ok: false, error: 'Only scheduled posts can be un-scheduled' }, 400);
  }
  // Best-effort delete of the FB native scheduled post — if it's already
  // gone (deleted in Meta's UI), that's the state we wanted anyway.
  let fbNote = '';
  if (post.fb_scheduled_post_id) {
    try {
      const userToken = await resolveAccessToken(service, post.workspace_id, post.client_id);
      if (userToken) {
        const targets = await resolveTargets(service, post.client_id, post.location_id);
        const pageToken = targets.pageId
          ? await getPageToken(targets.pageId, userToken)
          : userToken;
        await graphDelete(post.fb_scheduled_post_id, pageToken);
      }
    } catch (e) {
      fbNote = ` (Facebook scheduled post could not be deleted: ${(e as Error).message} — check Meta's Content Library)`;
    }
  }

  const now = new Date().toISOString();
  await service
    .from('content_posts')
    .update({
      status: 'approved',
      publish_at: null,
      pending_channels: [],
      fb_scheduled_post_id: null,
      updated_at: now,
    })
    .eq('id', post.id);
  await service
    .from('post_publishes')
    .update({ status: 'canceled' })
    .eq('content_post_id', post.id)
    .eq('status', 'scheduled');

  return json({ ok: true, status: 'approved', note: `Schedule canceled${fbNote}` });
}

/** Cron path: publish_at has arrived. Publish whatever is still pending
 * (IG); FB-native rows already published themselves on Meta's side. */
async function publishDue(
  service: ReturnType<typeof serviceClient>,
  post: PostRow,
): Promise<Response> {
  if (post.status !== 'scheduled') {
    return json({ ok: true, skipped: true, reason: `status is ${post.status}` });
  }
  const pending = Array.isArray(post.pending_channels) ? post.pending_channels : [];
  const now = new Date().toISOString();

  if (pending.length === 0) {
    // FB-native only — Meta publishes it; just reflect that.
    await service
      .from('content_posts')
      .update({ status: 'published', published_at: post.publish_at ?? now, updated_at: now })
      .eq('id', post.id);
    await service
      .from('post_publishes')
      .update({ status: 'published', published_at: post.publish_at ?? now })
      .eq('content_post_id', post.id)
      .eq('status', 'scheduled');
    return json({ ok: true, status: 'published', note: 'FB-native schedule — marked published' });
  }

  const ctx = await prepare(service, post, pending);
  if ('error' in ctx) {
    // Config was removed between scheduling and now — mark failed loudly.
    await service
      .from('content_posts')
      .update({ status: 'failed', publish_error: ctx.error, updated_at: now })
      .eq('id', post.id);
    return json({ ok: false, error: ctx.error }, 400);
  }

  // Reuse the scheduled audit row (it carries the FB native id).
  const { data: auditRow } = await service
    .from('post_publishes')
    .select('id')
    .eq('content_post_id', post.id)
    .eq('status', 'scheduled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const auditId = auditRow?.id as string | undefined;

  const results = await runChannels(service, post, ctx, auditId);

  const failed = results.filter((r) => !r.ok);
  const allOk = failed.length === 0;
  const fbNativeNote = post.fb_scheduled_post_id
    ? ' (Facebook was scheduled natively and publishes on Meta’s side)'
    : '';
  const errorText = failed.length
    ? failed.map((r) => `${r.channel}: ${r.error}`).join('; ') + fbNativeNote
    : null;

  await service
    .from('content_posts')
    .update({
      status: allOk ? 'published' : 'failed',
      published_at: allOk ? now : null,
      publish_error: errorText,
      pending_channels: allOk ? [] : pending,
      updated_at: now,
    })
    .eq('id', post.id);
  if (auditId) {
    await service
      .from('post_publishes')
      .update({ status: allOk ? 'published' : 'partial', error: errorText, published_at: allOk ? now : null })
      .eq('id', auditId);
  }

  return json({ ok: allOk, status: allOk ? 'published' : 'failed', results, error: errorText }, allOk ? 200 : 502);
}

/** Run the wanted channels, recording Graph ids on the audit row as they
 * land. Never throws — per-channel results carry ok/error. */
async function runChannels(
  service: ReturnType<typeof serviceClient>,
  post: PostRow,
  ctx: PublishContext,
  auditId: string | undefined,
): Promise<Array<{ channel: string; ok: boolean; id?: string; error?: string }>> {
  const results: Array<{ channel: string; ok: boolean; id?: string; error?: string }> = [];
  if (ctx.wantFb) {
    try {
      const fbId = await publishFacebook(post, ctx);
      results.push({ channel: 'facebook', ok: true, id: fbId });
      if (auditId) await service.from('post_publishes').update({ fb_post_id: fbId }).eq('id', auditId);
    } catch (e) {
      results.push({ channel: 'facebook', ok: false, error: (e as Error).message });
    }
  }
  if (ctx.wantIg) {
    try {
      const igId = await publishInstagram(post, ctx);
      results.push({ channel: 'instagram', ok: true, id: igId });
      if (auditId) await service.from('post_publishes').update({ ig_media_id: igId }).eq('id', auditId);
    } catch (e) {
      results.push({ channel: 'instagram', ok: false, error: (e as Error).message });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

/** Poll an async IG media container (video/Reels processing) until it's
 * ready to publish. Bounded: ~90s, then a clear error rather than an
 * opaque media_publish failure. */
async function waitForContainer(containerId: string, token: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const resp = await fetch(
      `${META_GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    const data = await resp.json().catch(() => ({}));
    const status = data?.status_code as string | undefined;
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Instagram video processing ${status.toLowerCase()} — check the video format (MP4/MOV, ≤90s for Reels)`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Instagram video is still processing after 90s — try publishing again in a minute');
}

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

async function graphDelete(objectId: string, accessToken: string): Promise<void> {
  const resp = await fetch(
    `${META_GRAPH}/${objectId}?access_token=${encodeURIComponent(accessToken)}`,
    { method: 'DELETE' },
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) {
    const err = data.error ?? {};
    throw new Error(`Meta delete /${objectId} failed: ${err.message ?? resp.statusText}`);
  }
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
