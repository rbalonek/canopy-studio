// test-connector
//
// "Send test" from Settings → Connections. Owner-gated (connectors are
// owner-managed); email tests go to the caller's own address.

import { CORS, json } from '../_shared/cors.ts';
import { authenticate, serviceClient } from '../_shared/auth.ts';
import { sendEmail, sendSlack } from '../_shared/notify.ts';

interface TestRequest {
  workspace_id: string;
  channel: 'email' | 'slack';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const body = (await req.json()) as TestRequest;
    if (!body?.workspace_id || !body?.channel) {
      return json({ ok: false, error: 'workspace_id and channel are required' }, 400);
    }

    const caller = await authenticate(req);
    if (!caller) return json({ ok: false, error: 'Invalid session' }, 401);

    // Owner gate — mirrors the workspace_connectors RLS.
    const service = serviceClient();
    const { data: ws } = await service
      .from('workspaces')
      .select('id, name, owner_id')
      .eq('id', body.workspace_id)
      .maybeSingle();
    if (!ws || ws.owner_id !== caller.userId) {
      return json({ ok: false, error: 'Only the workspace owner can test connectors' }, 403);
    }

    if (body.channel === 'slack') {
      const result = await sendSlack(service, {
        workspaceId: body.workspace_id,
        kind: 'test',
        text: `:white_check_mark: CanopyStudio test message for *${ws.name}* — your Slack connector works.`,
      });
      return json(result, result.ok ? 200 : 400);
    }

    // Email test → the caller's own address.
    const { data: userData } = await caller.userClient.auth.getUser();
    const email = userData?.user?.email;
    if (!email) return json({ ok: false, error: 'Your account has no email address' }, 400);

    const result = await sendEmail(service, {
      workspaceId: body.workspace_id,
      kind: 'test',
      to: [email],
      subject: `CanopyStudio test — ${ws.name}`,
      html: `<p>Your Resend connector for <strong>${ws.name}</strong> works. Client reports and suggestion alerts will arrive like this.</p>`,
    });
    return json(result, result.ok ? 200 : 400);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
