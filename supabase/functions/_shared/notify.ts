// Outbound notifications: Resend email + Slack incoming webhooks.
//
// Config lives in workspace_connectors (service-role read only — the
// Slack webhook is a credential). The Resend API key is a function
// secret (RESEND_API_KEY), shared across workspaces; the per-workspace
// part is the verified from-address. Every attempt is logged to
// notification_log.

import type { ServiceClient } from './auth.ts';

export interface ConnectorConfig {
  resendFromEmail: string | null;
  resendReplyTo: string | null;
  slackWebhookUrl: string | null;
}

export async function loadConnectors(
  service: ServiceClient,
  workspaceId: string,
): Promise<ConnectorConfig> {
  const { data } = await service
    .from('workspace_connectors')
    .select('resend_from_email, resend_reply_to, slack_webhook_url')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return {
    resendFromEmail: (data?.resend_from_email as string | null) ?? null,
    resendReplyTo: (data?.resend_reply_to as string | null) ?? null,
    slackWebhookUrl: (data?.slack_webhook_url as string | null) ?? null,
  };
}

async function log(
  service: ServiceClient,
  args: {
    workspaceId: string;
    channel: 'email' | 'slack';
    kind: string;
    target: string | null;
    status: 'sent' | 'failed';
    error?: string;
  },
): Promise<void> {
  const { error } = await service.from('notification_log').insert({
    workspace_id: args.workspaceId,
    channel: args.channel,
    kind: args.kind,
    target: args.target,
    status: args.status,
    error: args.error ?? null,
  });
  if (error) console.error('[notify] failed to write notification_log:', error.message);
}

export async function sendEmail(
  service: ServiceClient,
  args: {
    workspaceId: string;
    kind: string;
    to: string[];
    subject: string;
    html: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const connectors = await loadConnectors(service, args.workspaceId);
  const target = args.to.join(', ');

  let error: string | undefined;
  if (!apiKey) {
    error = 'RESEND_API_KEY is not configured (Edge Function secret)';
  } else if (!connectors.resendFromEmail) {
    error = 'No from-address configured in Settings → Connections (must be on a Resend-verified domain)';
  } else {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: connectors.resendFromEmail,
          to: args.to,
          subject: args.subject,
          html: args.html,
          ...(connectors.resendReplyTo ? { reply_to: connectors.resendReplyTo } : {}),
        }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        error = `Resend ${resp.status}: ${body.slice(0, 300)}`;
      }
    } catch (e) {
      error = (e as Error).message;
    }
  }

  await log(service, {
    workspaceId: args.workspaceId,
    channel: 'email',
    kind: args.kind,
    target,
    status: error ? 'failed' : 'sent',
    error,
  });
  return error ? { ok: false, error } : { ok: true };
}

export async function sendSlack(
  service: ServiceClient,
  args: {
    workspaceId: string;
    kind: string;
    text: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const connectors = await loadConnectors(service, args.workspaceId);

  let error: string | undefined;
  if (!connectors.slackWebhookUrl) {
    error = 'No Slack webhook configured in Settings → Connections';
  } else {
    try {
      const resp = await fetch(connectors.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: args.text }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        error = `Slack webhook ${resp.status}: ${body.slice(0, 200)}`;
      }
    } catch (e) {
      error = (e as Error).message;
    }
  }

  await log(service, {
    workspaceId: args.workspaceId,
    channel: 'slack',
    kind: args.kind,
    target: connectors.slackWebhookUrl ? 'slack webhook' : null,
    status: error ? 'failed' : 'sent',
    error,
  });
  return error ? { ok: false, error } : { ok: true };
}

/** Broadcast a short update on every configured channel (email goes to
 * the given recipients). Missing channels are skipped silently. */
export async function notifyWorkspace(
  service: ServiceClient,
  args: {
    workspaceId: string;
    kind: string;
    subject: string;
    text: string;
    html?: string;
    emailTo?: string[];
  },
): Promise<void> {
  const connectors = await loadConnectors(service, args.workspaceId);
  if (connectors.slackWebhookUrl) {
    await sendSlack(service, {
      workspaceId: args.workspaceId,
      kind: args.kind,
      text: `*${args.subject}*\n${args.text}`,
    });
  }
  if (connectors.resendFromEmail && args.emailTo?.length) {
    await sendEmail(service, {
      workspaceId: args.workspaceId,
      kind: args.kind,
      to: args.emailTo,
      subject: args.subject,
      html: args.html ?? `<p>${args.text.replace(/\n/g, '<br>')}</p>`,
    });
  }
}
