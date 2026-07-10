// Internal-call authentication for function-to-function chaining and
// pg_cron dispatch. Not user-facing: callers present a shared secret in
// the X-Internal-Secret header. The secret lives in the Edge Function
// secrets (INTERNAL_FN_SECRET) — never in migration SQL or the client.

export function isInternalCall(req: Request): boolean {
  const secret = Deno.env.get('INTERNAL_FN_SECRET');
  if (!secret) return false;
  return req.headers.get('X-Internal-Secret') === secret;
}

/** Fire a sibling Edge Function as an internal call. The target responds
 * 202 before doing its work (background task), so awaiting this is cheap
 * and confirms hand-off without waiting for the work itself. */
export async function invokeInternal(
  functionName: string,
  body: unknown,
): Promise<Response> {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${functionName}`;
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': Deno.env.get('INTERNAL_FN_SECRET') ?? '',
      // The platform requires a valid JWT-shaped Authorization header on
      // function invocations; the service key satisfies the gateway while
      // X-Internal-Secret is what our code actually trusts.
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(body),
  });
}
