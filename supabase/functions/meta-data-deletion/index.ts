// meta-data-deletion
//
// Meta's required Data Deletion Request callback (registered on the app's
// settings alongside the privacy policy URL). Meta POSTs a form-encoded
// signed_request when a user removes the app from their Facebook settings;
// we verify the HMAC with the app secret (verify_jwt = false — Meta sends
// no JWT; the signature is the gate), record the request, and answer with
// the status URL + confirmation code Meta requires.
//
// Deletion itself is operational: requests land in deletion_requests for
// processing (we can't map an app-scoped FB user id to a workspace
// automatically — connected tokens belong to businesses, not app users).

import { serviceClient } from '../_shared/auth.ts';

function b64urlDecode(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function verifySignedRequest(signedRequest: string, secret: string): Promise<Record<string, unknown> | null> {
  const dot = signedRequest.indexOf('.');
  if (dot < 0) return null;
  const sig = signedRequest.slice(0, dot);
  const payload = signedRequest.slice(dot + 1);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  const expected = b64urlDecode(sig);
  if (mac.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= mac[i] ^ expected[i];
  if (diff !== 0) return null;

  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('FB_APP_SECRET');
  if (!secret) return new Response('Not configured', { status: 500 });

  let signedRequest: string | null = null;
  try {
    const form = await req.formData();
    signedRequest = form.get('signed_request') as string | null;
  } catch {
    /* not form data */
  }
  if (!signedRequest) return new Response('signed_request is required', { status: 400 });

  const payload = await verifySignedRequest(signedRequest, secret);
  if (!payload) return new Response('Invalid signature', { status: 400 });

  const confirmationCode = crypto.randomUUID().slice(0, 8);
  const service = serviceClient();
  const { error } = await service.from('deletion_requests').insert({
    provider: 'meta',
    provider_user_id: (payload.user_id as string) ?? null,
    confirmation_code: confirmationCode,
  });
  if (error) {
    console.error('[meta-data-deletion] insert failed:', error.message);
    return new Response('Storage error', { status: 500 });
  }

  return new Response(
    JSON.stringify({
      url: `https://canopystudio.app/legal/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
