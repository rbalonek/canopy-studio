// Caller authentication + workspace-membership gating, extracted from the
// pattern both existing Edge Functions use:
//   - user-scoped client (anon key + caller JWT) validates the session,
//   - an RLS-gated select proves workspace membership,
//   - a service-role client does the privileged reads/writes afterwards.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type ServiceClient = ReturnType<typeof createClient>;

export function serviceClient(): ServiceClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export interface AuthedCaller {
  userId: string;
  /** User-scoped client — queries run under the caller's RLS. */
  userClient: ServiceClient;
}

/** Validate the Authorization header and return a user-scoped client.
 * Returns null when the JWT is missing/invalid. */
export async function authenticate(req: Request): Promise<AuthedCaller | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return { userId: data.user.id, userClient };
}

/** RLS-gated membership check via the workspaces table. */
export async function assertWorkspaceMember(
  caller: AuthedCaller,
  workspaceId: string,
): Promise<boolean> {
  const { data } = await caller.userClient
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .maybeSingle();
  return !!data;
}

/** RLS-gated client lookup: succeeds only for workspace members.
 * Returns the client's workspace_id, or null on no access. */
export async function assertClientAccess(
  caller: AuthedCaller,
  clientId: string,
): Promise<string | null> {
  const { data } = await caller.userClient
    .from('clients')
    .select('id, workspace_id')
    .eq('id', clientId)
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}
