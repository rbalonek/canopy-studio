// publish-meta-ad
//
// Turns a saved generation into real Meta objects: campaign → ad set →
// ad creative → ad. EVERYTHING IS CREATED WITH status=PAUSED — that is
// non-negotiable; a human flips things live in Ads Manager after
// review. This is the "make the ads but keep the campaign off" toggle.
//
// Requirements the caller must have set up:
//   - a Meta token with ads_management for the ad account (workspace
//     token or legacy per-client token — same resolution as the
//     refresh function). External client accounts need Advanced Access
//     + Meta App Review; a System User token on your own Business
//     Manager works without review (ship internal-first).
//   - an ad account id (location or meta_accounts) and a Facebook Page
//     id (link ads require a page identity).

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import { authenticate, serviceClient } from '../_shared/auth.ts';

const META_GRAPH = 'https://graph.facebook.com/v18.0';

interface PublishRequest {
  generation_id: string;
  /** Override; otherwise resolved from location/meta_accounts. */
  ad_account_id?: string;
  page_id?: string;
  daily_budget_cents?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as PublishRequest;
    if (!body?.generation_id) {
      return json({ ok: false, error: 'generation_id is required' }, 400);
    }

    const caller = await authenticate(req);
    if (!caller) return json({ ok: false, error: 'Invalid session' }, 401);

    // RLS gate: the generation is only visible to workspace members.
    const { data: gen } = await caller.userClient
      .from('generations')
      .select(
        'id, workspace_id, client_id, location_id, campaign_name, landing_page_url, medium, google_ads, meta_output',
      )
      .eq('id', body.generation_id)
      .maybeSingle();
    if (!gen) return json({ ok: false, error: 'Generation not found or access denied' }, 403);

    const meta = gen.meta_output as { primary_text?: string[]; headlines?: string[] } | null;
    if (!meta?.primary_text?.length || !meta?.headlines?.length) {
      return json({ ok: false, error: 'This generation has no META copy to publish' }, 400);
    }
    if (!gen.landing_page_url) {
      return json({ ok: false, error: 'A landing page URL is required to publish a link ad' }, 400);
    }

    const service = serviceClient();

    // Resolve token / ad account / page (same fallbacks as the refresh fn).
    const accessToken = await resolveAccessToken(service, gen.workspace_id, gen.client_id);
    if (!accessToken) {
      return json({ ok: false, error: 'No Meta access token configured (Settings → Connections)' }, 400);
    }
    const resolved = await resolveTargets(service, gen.client_id, gen.location_id);
    const adAccountId = sanitizeAct(body.ad_account_id) ?? resolved.adAccountId;
    const pageId = body.page_id?.trim() || resolved.pageId;
    if (!adAccountId) return json({ ok: false, error: 'No ad account configured for this client' }, 400);
    if (!pageId) {
      return json(
        { ok: false, error: 'No Facebook Page ID configured (set one on the client\'s Ad Accounts tab)' },
        400,
      );
    }

    const budget = Math.max(100, Math.min(body.daily_budget_cents ?? 1000, 1_000_000));

    // Audit row first — object ids fill in as the chain progresses.
    const { data: pub, error: pubErr } = await service
      .from('ad_publishes')
      .insert({
        workspace_id: gen.workspace_id,
        client_id: gen.client_id,
        generation_id: gen.id,
        ad_account_id: adAccountId,
        page_id: pageId,
        daily_budget_cents: budget,
        status: 'publishing',
        created_by: caller.userId,
      })
      .select('id')
      .single();
    if (pubErr || !pub) return json({ ok: false, error: pubErr?.message ?? 'Failed to record publish' }, 500);

    const track = async (patch: Record<string, unknown>) => {
      await service.from('ad_publishes').update(patch).eq('id', pub.id);
    };

    try {
      const name = (gen.campaign_name as string) || 'CanopyStudio campaign';

      // 1. Campaign — PAUSED, always.
      const campaign = await graphPost(`${adAccountId}/campaigns`, accessToken, {
        name,
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: '[]',
      });
      await track({ meta_campaign_id: campaign.id });

      // 2. Ad set — PAUSED, minimal broad targeting; refined in Ads Manager.
      const adset = await graphPost(`${adAccountId}/adsets`, accessToken, {
        name: `${name} — ad set`,
        campaign_id: campaign.id,
        status: 'PAUSED',
        daily_budget: String(budget),
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: JSON.stringify({ geo_locations: { countries: ['US'] } }),
      });
      await track({ meta_adset_id: adset.id });

      // 3. Creative from the generation's first primary text + headline.
      const creative = await graphPost(`${adAccountId}/adcreatives`, accessToken, {
        name: `${name} — creative`,
        object_story_spec: JSON.stringify({
          page_id: pageId,
          link_data: {
            link: gen.landing_page_url,
            message: meta.primary_text[0],
            name: meta.headlines[0],
            call_to_action: { type: 'LEARN_MORE', value: { link: gen.landing_page_url } },
          },
        }),
      });
      await track({ meta_creative_id: creative.id });

      // 4. Ad — PAUSED.
      const ad = await graphPost(`${adAccountId}/ads`, accessToken, {
        name: `${name} — ad 1`,
        adset_id: adset.id,
        creative: JSON.stringify({ creative_id: creative.id }),
        status: 'PAUSED',
      });

      await track({
        meta_ad_id: ad.id,
        status: 'paused_live',
        published_at: new Date().toISOString(),
      });

      return json({
        ok: true,
        publish_id: pub.id,
        campaign_id: campaign.id,
        adset_id: adset.id,
        ad_id: ad.id,
        note: 'Created PAUSED in Meta — review and activate in Ads Manager.',
      });
    } catch (e) {
      const message = (e as Error).message;
      await track({ status: 'failed', error: message });
      return json({ ok: false, error: message, publish_id: pub.id }, 502);
    }
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

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

async function resolveTargets(
  service: ReturnType<typeof serviceClient>,
  clientId: string,
  locationId: string | null,
): Promise<{ adAccountId: string | null; pageId: string | null }> {
  if (locationId) {
    const { data: loc } = await service
      .from('locations')
      .select('ad_account_id, page_id')
      .eq('id', locationId)
      .maybeSingle();
    if (loc?.ad_account_id) {
      return {
        adAccountId: sanitizeAct(loc.ad_account_id as string),
        pageId: (loc.page_id as string | null) ?? null,
      };
    }
  }
  const { data: legacy } = await service
    .from('meta_accounts')
    .select('account_id, page_id')
    .eq('client_id', clientId)
    .maybeSingle();
  return {
    adAccountId: sanitizeAct(legacy?.account_id as string | undefined),
    pageId: (legacy?.page_id as string | null) ?? null,
  };
}

function sanitizeAct(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).replace(/\s+/g, '');
  if (!trimmed) return null;
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}
