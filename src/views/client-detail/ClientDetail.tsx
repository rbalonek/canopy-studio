import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type { ClientHeader } from '../../data/types';
import { useAppState } from '../../shell/AppState';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { ClientFormModal } from '../ClientFormModal';
import { AdAccountsTab } from './AdAccountsTab';
import { AssetsTab } from './AssetsTab';
import { LiveCalendar } from '../calendar/LiveCalendar';
import { BrandTab } from './BrandTab';
import { CompetitorsTab } from './CompetitorsTab';
import { LocationsTab } from './LocationsTab';
import { OverviewTab } from './OverviewTab';
import { ScrapedPagesTab } from './ScrapedPagesTab';

type TabId =
  | 'overview'
  | 'brand'
  | 'assets'
  | 'calendar'
  | 'scraped pages'
  | 'competitors'
  | 'ad accounts'
  | 'locations';

const BASE_TABS: TabId[] = ['overview', 'brand', 'calendar', 'assets', 'scraped pages', 'competitors', 'ad accounts'];

export function ClientDetail() {
  const { state } = useAppState();
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const clientId = params.id ?? '';
  const shellPrefix = workspace ? `/app/${workspace.slug}` : '/dev';
  const clientsPath = `${shellPrefix}/clients`;

  // bump forces a header re-fetch after the client is edited.
  const [bump, setBump] = useState(0);
  const { data: header, loading } = useQuery<ClientHeader | null>(
    (p) => p.getClientHeader(clientId),
    [clientId, bump],
  );

  const [tab, setTab] = useState<TabId>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const singular = state.mode === 'agency' ? 'client' : 'location';

  async function onDeleteClient() {
    setMenuOpen(false);
    if (!supabase) return;
    if (
      !confirm(
        `Delete "${header?.name ?? clientId}"? This permanently removes the ${singular} and ALL its data — locations, campaign history, scraped pages, brand profile, saved generations. This can't be undone.`,
      )
    ) {
      return;
    }
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) {
      setRefreshMsg({ kind: 'err', text: `Delete failed: ${error.message}` });
      return;
    }
    navigate(clientsPath);
  }
  const tabs: TabId[] = state.mode === 'agency' ? [...BASE_TABS, 'locations'] : BASE_TABS;

  // Live only: show the brand logo (if analyzed/entered) in place of the
  // initials avatar. /dev (mock, no workspace) keeps the initials.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLogoUrl(null);
    if (!supabase || !workspace) return;
    supabase
      .from('brand_profiles')
      .select('logo_url')
      .eq('client_id', clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLogoUrl((data?.logo_url as string | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, workspace?.id]);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onRefreshMeta() {
    if (!supabase) {
      setRefreshMsg({ kind: 'err', text: 'Supabase not configured' });
      return;
    }
    setRefreshing(true);
    setRefreshMsg(null);
    const { data, error } = await supabase.functions.invoke('meta-refresh-client', {
      body: { client_id: clientId },
    });
    setRefreshing(false);
    if (error) {
      setRefreshMsg({ kind: 'err', text: error.message });
      return;
    }
    if (!data?.ok) {
      const detail = data?.errors?.length ? `: ${data.errors.join('; ')}` : '';
      setRefreshMsg({
        kind: 'err',
        text: (data?.error ?? 'Refresh failed') + detail,
      });
      return;
    }
    setRefreshMsg({
      kind: 'ok',
      text: `Refreshed ${data.refreshed ?? 0} campaigns across ${
        data.attempted?.length ?? 1
      } ad account(s).`,
    });
  }

  if (loading) {
    return (
      <div className="content wide">
        <span className="meta">Loading…</span>
      </div>
    );
  }

  if (!header) {
    return (
      <div className="content wide">
        <div className="card card-pad stack gap-8">
          <span className="h2">Not found</span>
          <span className="meta">
            No {state.mode === 'agency' ? 'client' : 'location'} with id "{clientId}".
          </span>
          <Link to={clientsPath} className="btn ghost sm" style={{ alignSelf: 'flex-start' }}>
            ← Back to {state.mode === 'agency' ? 'clients' : 'locations'}
          </Link>
        </div>
      </div>
    );
  }

  const initials = header.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');

  return (
    <div className="content wide">
      <div className="row gap-8 meta" style={{ marginBottom: 8 }}>
        <Link to={clientsPath} style={{ color: 'inherit', textDecoration: 'none' }}>
          {state.mode === 'agency' ? 'Clients' : 'Locations'}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>{header.name}</span>
      </div>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="row gap-12">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${header.name} logo`}
              // Auto-width up to a cap so a full wordmark fits; contained so it's
              // never cropped. Falls back to initials if the image fails to load.
              style={{ height: 48, maxWidth: 200, objectFit: 'contain', borderRadius: 8 }}
              onError={() => setLogoUrl(null)}
            />
          ) : (
            <div
              className="logo-mark"
              style={{ width: 44, height: 44, fontSize: 18, borderRadius: 10 }}
            >
              {initials}
            </div>
          )}
          <div className="stack gap-4">
            <h1 className="h0">{header.name}</h1>
            <div className="row gap-8 meta">
              <span>{header.industry}</span>·
              <span>
                {header.locationCount} {header.locationCount === 1 ? 'location' : 'locations'}
              </span>
            </div>
          </div>
        </div>
        <div className="row gap-8">
          <button className="btn ghost" onClick={onRefreshMeta} disabled={refreshing}>
            <Icon name="refresh" size={14} />
            {refreshing ? ' Refreshing…' : ' Refresh META'}
          </button>
          {/* Client-level Ad Studio: shown when this is a single-location
              setup (or no locations yet). Multi-location clients drive Ad
              Studio per-location to scope to each Page's brand + audience. */}
          {header.locationCount <= 1 && (
            <button
              className="btn ai"
              onClick={() => navigate(`${shellPrefix}/clients/${clientId}/ad-studio`)}
            >
              <Icon name="sparkles" size={14} /> Ad Studio
            </button>
          )}
          <button className="btn ai">
            <Icon name="sparkles" size={14} /> AI analyze
          </button>
          <div style={{ position: 'relative' }}>
            <button className="btn ghost" onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="dots" size={14} />
            </button>
            {menuOpen && (
              <>
                {/* click-away backdrop */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  className="card stack"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    zIndex: 41,
                    minWidth: 160,
                    padding: 4,
                  }}
                >
                  <button
                    className="btn ghost sm"
                    style={{ justifyContent: 'flex-start' }}
                    onClick={() => {
                      setMenuOpen(false);
                      setEditing(true);
                    }}
                  >
                    <Icon name="gear" size={13} /> Edit {singular}
                  </button>
                  <button
                    className="btn ghost sm"
                    style={{ justifyContent: 'flex-start', color: 'var(--danger, #c33)' }}
                    onClick={onDeleteClient}
                  >
                    <Icon name="close" size={13} /> Delete {singular}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {refreshMsg && (
        <div
          className="meta"
          style={{
            marginBottom: 12,
            color: refreshMsg.kind === 'err' ? 'var(--danger, #c33)' : 'var(--accent)',
            fontSize: 12,
          }}
        >
          {refreshMsg.kind === 'err' ? '⚠ ' : '✓ '}
          {refreshMsg.text}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 20 }}>
        {tabs.map((t) => (
          <div
            key={t}
            className={`tab ${tab === t ? 'on' : ''}`}
            onClick={() => setTab(t)}
            style={{ textTransform: 'capitalize' }}
          >
            {t}
          </div>
        ))}
      </div>

      {tab === 'overview' ? (
        <OverviewTab clientId={header.id} />
      ) : tab === 'brand' ? (
        <BrandTab clientId={header.id} />
      ) : tab === 'calendar' ? (
        <LiveCalendar clientId={header.id} />
      ) : tab === 'assets' ? (
        <AssetsTab clientId={header.id} />
      ) : tab === 'scraped pages' ? (
        <ScrapedPagesTab clientId={header.id} />
      ) : tab === 'competitors' ? (
        <CompetitorsTab clientId={header.id} />
      ) : tab === 'ad accounts' ? (
        <AdAccountsTab clientId={header.id} />
      ) : tab === 'locations' ? (
        <LocationsTab clientId={header.id} parentName={header.name} />
      ) : (
        <div className="card card-pad stack gap-8">
          <span className="h2" style={{ textTransform: 'capitalize' }}>{tab}</span>
          <span className="meta">Coming next — this tab isn't wired up yet.</span>
        </div>
      )}

      {editing && (
        <ClientFormModal
          singular={singular}
          workspaceId={workspace?.id ?? null}
          existingId={clientId}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setBump((b) => b + 1);
          }}
        />
      )}
    </div>
  );
}
