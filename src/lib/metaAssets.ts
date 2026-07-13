import { supabase } from '../auth/supabaseClient';
import { invokeErrorText } from './invokeError';

export type MetaAdAccount = { id: string; name: string | null };
export type MetaPage = {
  id: string;
  name: string | null;
  ig: { id: string; username: string | null } | null;
};
export type MetaAssets = { adAccounts: MetaAdAccount[]; pages: MetaPage[] };

/**
 * List the ad accounts + Pages (+ linked IG business accounts) the stored
 * Meta credential can see, via meta-oauth's member-gated 'assets' action.
 * Resolution order matches refresh/publish: client override → workspace
 * master → legacy meta_accounts token. The token never reaches the browser.
 * Throws with the function's real error message.
 */
export async function fetchMetaAssets(
  workspaceId: string,
  clientId?: string,
): Promise<MetaAssets> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('meta-oauth', {
    body: {
      action: 'assets',
      workspace_id: workspaceId,
      ...(clientId ? { client_id: clientId } : {}),
    },
  });
  if (error || !data?.ok) throw new Error(await invokeErrorText(data, error));
  return {
    adAccounts: ((data.ad_accounts as MetaAdAccount[] | undefined) ?? []).map((a) => ({
      id: a.id,
      name: a.name ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pages: (((data.pages as any[] | undefined) ?? []) as any[]).map((p) => ({
      id: p.id as string,
      name: (p.name as string | null) ?? null,
      ig: p.instagram_business_account
        ? {
            id: p.instagram_business_account.id as string,
            username: (p.instagram_business_account.username as string | null) ?? null,
          }
        : null,
    })),
  };
}
