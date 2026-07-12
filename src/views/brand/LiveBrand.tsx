import { useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { BrandTab } from '../client-detail/BrandTab';
import { CompetitorsTab } from '../client-detail/CompetitorsTab';
import { ScrapedPagesTab } from '../client-detail/ScrapedPagesTab';
import { AssetsTab } from '../client-detail/AssetsTab';

/**
 * Live Brand Intelligence: a workspace-level lens over the live per-client
 * brand surfaces that already exist (BrandTab, CompetitorsTab,
 * ScrapedPagesTab, AssetsTab) — a client picker plus tabs, the same
 * composition LiveCalendar uses. No duplicate implementations: the /dev
 * wireframe keeps its own richer cross-client mock views until the
 * cross-client rollups (rules, compare, gaps) earn a live port.
 */

type TabId = 'brand' | 'competitors' | 'websites' | 'assets';
const TABS: { id: TabId; label: string }[] = [
  { id: 'brand', label: 'Brand profile' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'websites', label: 'Scraped pages' },
  { id: 'assets', label: 'Assets' },
];

export function LiveBrand() {
  const workspace = useWorkspace();
  const [clients, setClients] = useState<{ id: string; name: string }[] | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [tab, setTab] = useState<TabId>('brand');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase || !workspace) return;
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .eq('workspace_id', workspace.id)
        .order('name');
      if (cancelled) return;
      const list = (data ?? []) as { id: string; name: string }[];
      setClients(list);
      setClientId((cur) => cur || (list[0]?.id ?? ''));
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  if (!workspace) return null;

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div className="stack gap-4">
          <h1 className="h0">Brand Intelligence</h1>
          <span className="meta">Each client's brand profile, competitors, site content, and assets.</span>
        </div>
        {clients && clients.length > 0 && (
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--fg)',
              padding: '6px 10px',
              font: 'inherit',
            }}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {clients === null ? (
        <span className="meta">Loading…</span>
      ) : clients.length === 0 ? (
        <div className="card card-pad">
          <span className="meta">No clients yet — add one from the Clients page to build its brand intelligence.</span>
        </div>
      ) : (
        <>
          <div className="tabs" style={{ marginBottom: 20 }}>
            {TABS.map((t) => (
              <div key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </div>
            ))}
          </div>
          {tab === 'brand' ? (
            <BrandTab clientId={clientId} />
          ) : tab === 'competitors' ? (
            <CompetitorsTab clientId={clientId} />
          ) : tab === 'websites' ? (
            <ScrapedPagesTab clientId={clientId} />
          ) : (
            <AssetsTab clientId={clientId} />
          )}
        </>
      )}
    </div>
  );
}
