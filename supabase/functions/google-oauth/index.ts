// google-oauth
//
// Google Ads connect flow — structural clone of meta-oauth (one stable URL,
// POST start / GET callback, single-use oauth_states row as the callback
// gate). The consent request uses access_type=offline + prompt=consent so
// Google returns a REFRESH token, which is what we store: access tokens are
// minted from it per refresh run in google-ads-refresh.
//
// Secrets: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (the OAuth
// client whose redirect URI is this function's URL — a separate client from
// the Supabase sign-in one).

// deno-lint-ignore-file no-explicit-any
import { CORS, json } from '../_shared/cors.ts';
import { authenticate, serviceClient } from '../_shared/auth.ts';

const SCOPE = 'https://www.googleapis.com/auth/adwords';

function redirectUri(): string {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-oauth`;
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
      login_customer_id?: string;
      return_to?: string;
    };
    if (body.action !== 'start' || !body.workspace_id) {
      return json({ ok: false, error: 'action "start" and workspace_id are required' }, 400);
    }
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    if (!clientId || !Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')) {
      return json(
        { ok: false, error: 'Google OAuth is not configured yet (GOOGLE_OAUTH_CLIENT_ID/SECRET pending).' },
        400,
      );
    }

    const caller = await authenticate(req);
    if (!caller) return json({ ok: false, error: 'Invalid session' }, 401);

    const service = serviceClient();
    const { data: ws } = await service
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', body.workspace_id)
      .maybeSingle();
    if (!ws) return json({ ok: false, error: 'Workspace not found' }, 404);
    if (ws.owner_id !== caller.userId) {
      return json({ ok: false, error: 'Only the workspace owner can connect Google Ads.' }, 403);
    }

    // The MCC id (digits only) rides in ahead of the OAuth dance so the
    // callback can store both halves in one write.
    if (body.login_customer_id) {
      const { error } = await service.from('workspace_google_credentials').upsert(
        {
          workspace_id: body.workspace_id,
          login_customer_id: body.login_customer_id.replace(/-/g, ''),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id' },
      );
      if (error) return json({ ok: false, error: error.message }, 500);
    }

    const returnTo = body.return_to && /^https?:\/\//.test(body.return_to) ? body.return_to : null;
    const { data: state, error } = await service
      .from('oauth_states')
      .insert({
        workspace_id: body.workspace_id,
        provider: 'google',
        return_to: returnTo,
        created_by: caller.userId,
      })
      .select('id')
      .single();
    if (error || !state) return json({ ok: false, error: error?.message ?? 'state insert failed' }, 500);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state: state.id as string,
    });
    return json({ ok: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const stateId = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const gError = url.searchParams.get('error');

  if (!stateId) return new Response('Missing state', { status: 400 });

  const service = serviceClient();
  const { data: state } = await service
    .from('oauth_states')
    .delete()
    .eq('id', stateId)
    .eq('provider', 'google')
    .select('workspace_id, return_to, created_at')
    .maybeSingle();
  if (!state) return new Response('Unknown or already-used state', { status: 400 });

  const back = (result: string) => {
    const target = (state.return_to as string | null) ?? 'https://canopystudio.app';
    const sep = target.includes('?') ? '&' : '?';
    return new Response(null, { status: 302, headers: { Location: `${target}${sep}${result}` } });
  };

  if (Date.now() - new Date(state.created_at as string).getTime() > 10 * 60_000) {
    return back('google=error&reason=expired');
  }
  if (gError || !code) return back(`google=error&reason=${encodeURIComponent(gError ?? 'no code')}`);

  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
        code,
      }),
    });
    const data = (await resp.json()) as any;
    if (!resp.ok || !data.refresh_token) {
      throw new Error(
        data?.error_description ??
          data?.error ??
          'no refresh token returned (re-run with prompt=consent)',
      );
    }
    const { error } = await service.from('workspace_google_credentials').upsert(
      {
        workspace_id: state.workspace_id,
        refresh_token: data.refresh_token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    );
    if (error) throw new Error(error.message);
    return back('google=connected');
  } catch (e) {
    console.error('[google-oauth] exchange failed:', (e as Error).message);
    return back(`google=error&reason=${encodeURIComponent((e as Error).message)}`);
  }
}
