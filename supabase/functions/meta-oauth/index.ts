// meta-oauth
//
// Facebook Login for Business connect flow. Two entry points on one
// function (the OAuth redirect URI must be a single stable URL):
//
//   POST (authed, workspace-owner-gated)
//     { action: 'start', workspace_id, client_id?, return_to }
//     → inserts a single-use oauth_states row and returns the
//       facebook.com dialog URL for the browser to navigate to.
//
//   GET ?code=…&state=…   (the redirect back from Meta)
//     verify_jwt = false — the browser arrives from facebook.com with no
//     JWT. The gate is the state row: it must exist, be < 10 minutes old,
//     and is deleted before use (single-use). Exchanges code → short
//     token → long-lived token (~60 days) and upserts it into the
//     EXISTING credential tables (workspace_meta_credentials, or
//     client_meta_credentials when the state row carries a client_id) —
//     resolveAccessToken in the publish/refresh functions is untouched.
//     Redirects back to the Settings page that started the flow with
//     ?meta=connected or ?meta=error&reason=….
//
// Secrets: FB_APP_ID, FB_APP_SECRET, optional FB_LOGIN_CONFIG_ID (the
// Facebook Login for Business configuration id; falls back to a plain
// scope list until one exists).

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import { authenticate, serviceClient } from '../_shared/auth.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';
const SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_business_basic',
  'instagram_business_content_publish',
  'ads_management',
  'business_management',
].join(',');

function redirectUri(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/meta-oauth`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method === 'GET') return await handleCallback(req);
  return await handleStart(req);
});

async function handleStart(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      action?: string;
      workspace_id?: string;
      client_id?: string;
      return_to?: string;
    };
    if (body.action !== 'start' || !body.workspace_id) {
      return json({ ok: false, error: 'action "start" and workspace_id are required' }, 400);
    }
    const appId = Deno.env.get('FB_APP_ID');
    if (!appId || !Deno.env.get('FB_APP_SECRET')) {
      return json({ ok: false, error: 'Meta OAuth is not configured yet (FB_APP_ID/FB_APP_SECRET pending).' }, 400);
    }

    const caller = await authenticate(req);
    if (!caller) return json({ ok: false, error: 'Invalid session' }, 401);

    const service = serviceClient();
    // Owner-only: this writes the workspace's master credential.
    const { data: ws } = await service
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', body.workspace_id)
      .maybeSingle();
    if (!ws) return json({ ok: false, error: 'Workspace not found' }, 404);
    if (ws.owner_id !== caller.userId) {
      return json({ ok: false, error: 'Only the workspace owner can connect Meta.' }, 403);
    }

    const returnTo =
      body.return_to && /^https?:\/\//.test(body.return_to) ? body.return_to : null;
    const { data: state, error } = await service
      .from('oauth_states')
      .insert({
        workspace_id: body.workspace_id,
        client_id: body.client_id ?? null,
        provider: 'meta',
        return_to: returnTo,
        created_by: caller.userId,
      })
      .select('id')
      .single();
    if (error || !state) return json({ ok: false, error: error?.message ?? 'state insert failed' }, 500);

    const configId = Deno.env.get('FB_LOGIN_CONFIG_ID');
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri(),
      state: state.id as string,
      response_type: 'code',
      ...(configId ? { config_id: configId } : { scope: SCOPES }),
    });
    return json({ ok: true, url: `https://www.facebook.com/v21.0/dialog/oauth?${params}` });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const stateId = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const fbError = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  if (!stateId) return new Response('Missing state', { status: 400 });

  const service = serviceClient();
  // Single-use: claim-and-delete the state row before any exchange.
  const { data: state } = await service
    .from('oauth_states')
    .delete()
    .eq('id', stateId)
    .eq('provider', 'meta')
    .select('workspace_id, client_id, return_to, created_at')
    .maybeSingle();
  if (!state) return new Response('Unknown or already-used state', { status: 400 });

  const back = (result: string) => {
    const target = (state.return_to as string | null) ?? 'https://canopystudio.app';
    const sep = target.includes('?') ? '&' : '?';
    return new Response(null, { status: 302, headers: { Location: `${target}${sep}${result}` } });
  };

  if (Date.now() - new Date(state.created_at as string).getTime() > 10 * 60_000) {
    return back('meta=error&reason=expired');
  }
  if (fbError || !code) {
    return back(`meta=error&reason=${encodeURIComponent(fbError ?? 'no code returned')}`);
  }

  try {
    const appId = Deno.env.get('FB_APP_ID')!;
    const appSecret = Deno.env.get('FB_APP_SECRET')!;

    // code → short-lived token
    const shortResp = await fetch(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri(),
        code,
      })}`,
    );
    const short = (await shortResp.json()) as any;
    if (!shortResp.ok || !short.access_token) {
      throw new Error(short?.error?.message ?? 'code exchange failed');
    }

    // short → long-lived (~60 days)
    const longResp = await fetch(
      `${GRAPH}/oauth/access_token?${new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: short.access_token,
      })}`,
    );
    const long = (await longResp.json()) as any;
    const token = (long.access_token as string) ?? (short.access_token as string);
    const expiresIn = Number(long.expires_in ?? short.expires_in ?? 0);
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const now = new Date().toISOString();
    if (state.client_id) {
      const { error } = await service.from('client_meta_credentials').upsert(
        {
          client_id: state.client_id,
          access_token: token,
          expires_at: expiresAt,
          label: 'Facebook Login',
          updated_at: now,
        },
        { onConflict: 'client_id' },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await service.from('workspace_meta_credentials').upsert(
        {
          workspace_id: state.workspace_id,
          access_token: token,
          expires_at: expiresAt,
          updated_at: now,
        },
        { onConflict: 'workspace_id' },
      );
      if (error) throw new Error(error.message);
    }
    return back('meta=connected');
  } catch (e) {
    console.error('[meta-oauth] exchange failed:', (e as Error).message);
    return back(`meta=error&reason=${encodeURIComponent((e as Error).message)}`);
  }
}
