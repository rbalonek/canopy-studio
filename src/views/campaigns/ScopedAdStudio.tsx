import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { AdStudio } from '../AdStudio';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

/**
 * Scoped wrapper around the wireframe Ad Studio. Mounted at:
 *   /clients/:id/ad-studio                       — scope: a client
 *   /clients/:id/locations/:locId/ad-studio      — scope: a specific
 *     location within a client (multi-location workflow)
 *
 * For now the actual Ad Studio body is still the wireframe (no real
 * generation yet). What this view adds is the scope context up top
 * (breadcrumb + "Ad Studio for <name>" header), so when real ad-copy
 * generation lands it knows which Page / brand profile / industry
 * to brief Claude with.
 */
export function ScopedAdStudio() {
  const { id: clientId, locId } = useParams<{ id: string; locId?: string }>();
  const workspace = useWorkspace();
  const [scope, setScope] = useState<{
    clientName: string;
    locationName: string | null;
  } | null>(null);

  useEffect(() => {
    if (!supabase || !clientId) {
      setScope(null);
      return;
    }
    Promise.all([
      supabase.from('clients').select('name').eq('id', clientId).maybeSingle(),
      locId
        ? supabase.from('locations').select('name').eq('id', locId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([cRes, lRes]) => {
      setScope({
        clientName: (cRes.data?.name as string) ?? '',
        locationName: (lRes.data as { name?: string } | null)?.name ?? null,
      });
    });
  }, [clientId, locId]);

  const prefix = workspace ? `/app/${workspace.slug}` : '/dev';
  const clientPath = `${prefix}/clients/${clientId}`;
  const locationPath = locId ? `${clientPath}/locations/${locId}` : null;
  const scopeTitle = scope?.locationName ?? scope?.clientName ?? '';

  return (
    <div className="content wide">
      <div className="row gap-8 meta" style={{ marginBottom: 8 }}>
        <Link to={`${prefix}/clients`} style={{ color: 'inherit', textDecoration: 'none' }}>
          Clients
        </Link>
        <span>/</span>
        <Link to={clientPath} style={{ color: 'inherit', textDecoration: 'none' }}>
          {scope?.clientName || 'Client'}
        </Link>
        {locationPath && (
          <>
            <span>/</span>
            <Link to={locationPath} style={{ color: 'inherit', textDecoration: 'none' }}>
              {scope?.locationName || 'Location'}
            </Link>
          </>
        )}
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>Ad Studio</span>
      </div>

      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4">
          <h1 className="h0" style={{ fontSize: 24 }}>
            Ad Studio · {scopeTitle}
          </h1>
          <span className="meta">
            {locId
              ? 'Generates ad copy + creative scoped to this location only — uses its Page, ad account, brand rules, and industry.'
              : 'Generates ad copy + creative for this client. For multi-location clients, open a location to scope to its individual Page.'}
          </span>
        </div>
      </div>

      <AdStudio />
    </div>
  );
}
