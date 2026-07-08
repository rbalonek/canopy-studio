import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { Ring } from '../../components/Ring';
import { useJobRunner } from '../../data/useJob';
import type { Location } from '../../data/types';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

type Props = {
  clientId: string;
  parentName: string;
};

function initialsFromLocationName(name: string): string {
  const parts = name.split('—');
  const tail = parts.length > 1 ? parts[parts.length - 1].trim() : name;
  return tail.slice(0, 2);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

/** Normalize an `act_…` ad account ID. Strips whitespace and ensures the
 * prefix. Returns empty string for empty input. */
function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.replace(/\s+/g, '');
  if (!trimmed) return '';
  return trimmed.startsWith('act_') ? trimmed : `act_${trimmed}`;
}

type Suggestion = {
  id: string;
  name: string;
  url: string;
  confidence: number;
};

/** Scrape a location's own pages (best-effort, fire-and-forget): the
 * location URL itself plus up to 4 already-discovered subpages under it
 * (e.g. /asheville → /asheville/birthdays), tagged with the location so
 * location-scoped AI jobs read the right content. `discoveredUrls` is the
 * domain row's recorded discovery set — pass it when you already have it
 * (batch confirms), otherwise it's fetched here. */
async function scrapeLocationPages(
  clientId: string,
  locationId: string,
  locationUrl: string,
  discoveredUrls?: string[],
) {
  if (!supabase) return;
  if (!discoveredUrls) {
    const { data: domainRow } = await supabase
      .from('scraped_domains')
      .select('discovered_urls')
      .eq('client_id', clientId)
      .is('competitor_id', null)
      .order('last_crawled_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    discoveredUrls = Array.isArray(domainRow?.discovered_urls)
      ? (domainRow!.discovered_urls as string[])
      : [];
  }
  const urls = [locationUrl];
  try {
    const locPath = new URL(locationUrl).pathname.replace(/\/+$/, '');
    if (locPath) {
      const strip = (h: string) => h.replace(/^www\./i, '');
      const locHost = strip(new URL(locationUrl).hostname);
      for (const u of discoveredUrls) {
        if (urls.length >= 5) break;
        try {
          const p = new URL(u);
          if (strip(p.hostname) !== locHost) continue;
          const path = p.pathname.replace(/\/+$/, '');
          if (path !== locPath && path.startsWith(`${locPath}/`)) urls.push(u);
        } catch {
          // skip unparseable discovered URLs
        }
      }
    }
  } catch {
    // location URL unparseable — scrape it verbatim and let the function decide
  }
  supabase.functions
    .invoke('scrape-client', {
      body: { client_id: clientId, url: locationUrl, urls, location_id: locationId },
    })
    .catch((e) => console.warn('Location page scrape failed:', e));
}

export function LocationsTab({ clientId, parentName }: Props) {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[] | null>(null);
  // Per-ad_account aggregates from live campaigns. Keyed by ad_account_id.
  const [aggsByAccount, setAggsByAccount] = useState<
    Record<string, { mtdSpend: number; activeCampaigns: number }>
  >({});
  // null = closed; 'new' = adding; <id> = editing that location
  const [formState, setFormState] = useState<'new' | string | null>(null);
  // Pending multi-location detections awaiting confirmation.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  // Manual "Detect locations" run — re-classifies the last scrape's link data.
  const detect = useJobRunner<{ multi_location: boolean; new_suggestions: number }>();
  // The parent client's analyzed/entered logo, shown on each location card in
  // place of the initials. /dev (mock, no workspace) keeps the initials.
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
  }, [clientId, workspace]);

  async function refresh() {
    if (!supabase) {
      setLocations([]);
      return;
    }
    const { data, error } = await supabase
      .from('locations')
      .select(
        'id, name, address, url, mtd_spend, active_campaigns, posts_per_week, complete, page_id, instagram_business_account_id, ad_account_id',
      )
      .eq('client_id', clientId)
      .order('name');
    if (error || !data) {
      setLocations([]);
      return;
    }
    setLocations(
      data.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        address: r.address as string,
        url: (r.url as string | null) ?? null,
        mtdSpend: r.mtd_spend as string,
        activeCampaigns: r.active_campaigns as number,
        postsPerWeek: r.posts_per_week as number,
        complete: r.complete as number,
        pageId: (r.page_id as string | null) ?? null,
        instagramBusinessAccountId: (r.instagram_business_account_id as string | null) ?? null,
        adAccountId: (r.ad_account_id as string | null) ?? null,
      })),
    );
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function refreshSuggestions() {
    if (!supabase || !workspace) return;
    const { data } = await supabase
      .from('location_suggestions')
      .select('id, name, url, confidence')
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .order('confidence', { ascending: false })
      .order('name');
    const rows = (data ?? []) as Suggestion[];
    setSuggestions(rows);
    setSelectedSuggestions(new Set(rows.map((s) => s.id)));
  }

  useEffect(() => {
    refreshSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, workspace?.id]);

  // A finished manual detection run may have staged new suggestions.
  useEffect(() => {
    if (detect.completed) refreshSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detect.completed]);

  /** Confirm the checked suggestions: create a location per row (URL kept),
   * mark the suggestion added, and kick off a tagged scrape of each
   * location's pages in the background. */
  async function addSelectedSuggestions() {
    if (!supabase || selectedSuggestions.size === 0) return;
    setConfirming(true);
    // The domain's discovery set feeds subpage scraping (/asheville/birthdays).
    const { data: domainRow } = await supabase
      .from('scraped_domains')
      .select('discovered_urls')
      .eq('client_id', clientId)
      .is('competitor_id', null)
      .order('last_crawled_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const discoveredUrls = Array.isArray(domainRow?.discovered_urls)
      ? (domainRow!.discovered_urls as string[])
      : [];

    for (const s of suggestions.filter((s) => selectedSuggestions.has(s.id))) {
      const locationId = `${slugify(s.name)}-${randomSuffix()}`;
      const { error } = await supabase.from('locations').insert({
        id: locationId,
        client_id: clientId,
        name: s.name,
        address: '',
        url: s.url,
      });
      if (error) {
        console.warn(`Failed to add location "${s.name}":`, error.message);
        continue;
      }
      await supabase
        .from('location_suggestions')
        .update({ status: 'added' })
        .eq('id', s.id);
      scrapeLocationPages(clientId, locationId, s.url, discoveredUrls);
    }
    setConfirming(false);
    refresh();
    refreshSuggestions();
  }

  async function dismissSuggestion(s: Suggestion) {
    if (!supabase) return;
    setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
    await supabase.from('location_suggestions').update({ status: 'dismissed' }).eq('id', s.id);
  }

  // Pull all campaigns for this client and bucket aggregates by
  // ad_account_id, so each location card can show its real spend +
  // active campaign count instead of the placeholder $0/0.
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('campaigns')
      .select('ad_account_id, status, mtd_spend')
      .eq('client_id', clientId)
      .then(({ data }) => {
        const map: Record<string, { mtdSpend: number; activeCampaigns: number }> = {};
        for (const r of data ?? []) {
          const acct = (r.ad_account_id as string | null) ?? '';
          if (!acct) continue;
          const agg = map[acct] ?? { mtdSpend: 0, activeCampaigns: 0 };
          agg.mtdSpend += parseFloat(String(r.mtd_spend ?? 0)) || 0;
          if (r.status === 'ACTIVE') agg.activeCampaigns += 1;
          map[acct] = agg;
        }
        setAggsByAccount(map);
      });
  }, [clientId, locations?.length]);

  async function onDelete(loc: Location) {
    if (!supabase) return;
    if (!confirm(`Delete location "${loc.name}"? This can't be undone.`)) return;
    await supabase.from('locations').delete().eq('id', loc.id);
    refresh();
  }

  function openLocation(loc: Location) {
    const prefix = workspace ? `/app/${workspace.slug}` : '/dev';
    navigate(`${prefix}/clients/${clientId}/locations/${loc.id}`);
  }

  if (locations === null) {
    return <div className="meta">Loading…</div>;
  }

  return (
    <div className="stack gap-12">
      {workspace && (
        <div className="row between">
          <span className="meta">
            {detect.running
              ? 'Scanning the website’s link structure for per-location pages…'
              : detect.startError
                ? `⚠ ${detect.startError}`
                : detect.failed
                  ? `⚠ ${detect.job?.error ?? 'Detection failed'}`
                  : detect.completed
                    ? (detect.job?.result?.new_suggestions ?? 0) > 0
                      ? `Found ${detect.job?.result?.new_suggestions} new location${
                          (detect.job?.result?.new_suggestions ?? 0) === 1 ? '' : 's'
                        } — review below.`
                      : detect.job?.result?.multi_location
                        ? 'No new locations — everything detected is already listed or dismissed.'
                        : 'This looks like a single-location website.'
                    : ''}
          </span>
          <button
            className="btn ghost sm"
            disabled={detect.running}
            title="Re-scan the scraped site structure for per-location pages"
            onClick={() =>
              detect.start({
                type: 'location_detection',
                workspaceId: workspace.id,
                clientId,
                input: {},
              })
            }
          >
            <Icon name="sparkles" size={13} />{' '}
            {detect.running ? 'Detecting…' : 'Detect locations'}
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="card card-pad stack gap-10">
          <div className="row between">
            <div className="stack" style={{ gap: 2 }}>
              <div style={{ fontWeight: 500 }}>
                <Icon name="sparkles" size={13} /> Detected {suggestions.length} location
                {suggestions.length === 1 ? '' : 's'} on the website
              </div>
              <div className="meta">
                The scraper found what look like per-location pages. Confirm the ones that are
                real locations — each is created below and its pages are scraped for AI
                grounding. Dismissed ones won't be suggested again.
              </div>
            </div>
          </div>
          <div className="stack gap-4">
            {suggestions.map((s) => (
              <label
                key={s.id}
                className="row gap-8"
                style={{ alignItems: 'center', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={selectedSuggestions.has(s.id)}
                  disabled={confirming}
                  onChange={(e) => {
                    setSelectedSuggestions((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(s.id);
                      else next.delete(s.id);
                      return next;
                    });
                  }}
                />
                <span style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</span>
                <span className="meta mono" style={{ fontSize: 11 }}>
                  {suggestionPath(s.url)}
                </span>
                {s.confidence < 70 && (
                  <span className="pill amber" style={{ fontSize: 10 }}>
                    unsure
                  </span>
                )}
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={confirming}
                  title="Not a location — don't suggest again"
                  onClick={(e) => {
                    e.preventDefault();
                    dismissSuggestion(s);
                  }}
                  style={{ marginLeft: 'auto' }}
                >
                  Dismiss
                </button>
              </label>
            ))}
          </div>
          <div className="row gap-8">
            <button
              className="btn primary sm"
              disabled={confirming || selectedSuggestions.size === 0}
              onClick={addSelectedSuggestions}
            >
              {confirming
                ? 'Adding…'
                : `Add ${selectedSuggestions.size} location${
                    selectedSuggestions.size === 1 ? '' : 's'
                  }`}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
      {locations.map((l) =>
        formState === l.id ? (
          <LocationForm
            key={l.id}
            clientId={clientId}
            existing={l}
            onCancel={() => setFormState(null)}
            onSaved={() => {
              setFormState(null);
              refresh();
            }}
          />
        ) : (
          <LocationCard
            key={l.id}
            location={l}
            parentName={parentName}
            logoUrl={logoUrl}
            liveAggs={l.adAccountId ? aggsByAccount[l.adAccountId] : undefined}
            onOpen={() => openLocation(l)}
            onAdStudio={() => {
              const p = workspace ? `/app/${workspace.slug}` : '/dev';
              navigate(`${p}/clients/${clientId}/locations/${l.id}/ad-studio`);
            }}
            onEdit={() => setFormState(l.id)}
            onDelete={() => onDelete(l)}
          />
        ),
      )}

      {formState === 'new' ? (
        <LocationForm
          clientId={clientId}
          existing={null}
          onCancel={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            refresh();
          }}
        />
      ) : (
        <button
          type="button"
          className="card card-pad stack gap-8"
          style={{
            borderStyle: 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 180,
            cursor: 'pointer',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
          }}
          onClick={() => setFormState('new')}
        >
          <Icon name="plus" size={24} />
          <span style={{ fontWeight: 500 }}>Add location</span>
          <span className="meta">Inherits brand rules from parent</span>
        </button>
      )}
      </div>
    </div>
  );
}

/** Compact display form of a suggestion URL: path when same-site, host+path
 * otherwise. */
function suggestionPath(u: string): string {
  try {
    const p = new URL(u);
    return p.pathname === '/' ? p.hostname : p.pathname.replace(/\/$/, '');
  } catch {
    return u;
  }
}

function LocationCard({
  location: l,
  parentName,
  logoUrl,
  liveAggs,
  onOpen,
  onAdStudio,
  onEdit,
  onDelete,
}: {
  location: Location;
  parentName: string;
  logoUrl?: string | null;
  liveAggs?: { mtdSpend: number; activeCampaigns: number };
  onOpen: () => void;
  onAdStudio: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Fall back to initials if there's no brand logo or the image fails to load.
  const [logoBroken, setLogoBroken] = useState(false);
  // Prefer live aggregates from the campaigns table when we have them;
  // fall back to whatever's on the locations row.
  const mtdLabel = liveAggs
    ? `$${liveAggs.mtdSpend.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : l.mtdSpend;
  const campaignsLabel = liveAggs ? liveAggs.activeCampaigns : l.activeCampaigns;
  return (
    <div className="card card-pad stack gap-10">
      <div className="row between">
        <div className="row gap-8">
          {logoUrl && !logoBroken ? (
            <img
              src={logoUrl}
              alt={`${parentName} logo`}
              onError={() => setLogoBroken(true)}
              style={{ height: 28, maxWidth: 104, objectFit: 'contain', borderRadius: 6 }}
            />
          ) : (
            <div className="logo-mark" style={{ width: 28, height: 28, fontSize: 12 }}>
              {initialsFromLocationName(l.name)}
            </div>
          )}
          <div className="stack">
            <span style={{ fontWeight: 500, fontSize: 13 }}>{l.name}</span>
            <span className="meta">{l.address || (l.url ? suggestionPath(l.url) : '')}</span>
          </div>
        </div>
        <Ring p={l.complete} />
      </div>
      <div className="row gap-16" style={{ paddingTop: 4 }}>
        <div className="stack">
          <span className="meta">Spend MTD</span>
          <span style={{ fontWeight: 500 }}>{mtdLabel}</span>
        </div>
        <div className="stack">
          <span className="meta">Campaigns</span>
          <span style={{ fontWeight: 500 }}>{campaignsLabel}</span>
        </div>
        <div className="stack">
          <span className="meta">Posts/wk</span>
          <span style={{ fontWeight: 500 }}>{l.postsPerWeek}</span>
        </div>
      </div>
      {(l.pageId || l.instagramBusinessAccountId || l.adAccountId) && (
        <div className="stack gap-2" style={{ paddingTop: 4 }}>
          {l.adAccountId && (
            <div className="row gap-6" style={{ fontSize: 11 }}>
              <span className="meta">Ad account</span>
              <span className="mono" style={{ color: 'var(--fg-2)' }}>
                {l.adAccountId}
              </span>
            </div>
          )}
          {l.pageId && (
            <div className="row gap-6" style={{ fontSize: 11 }}>
              <span className="meta">FB Page</span>
              <span className="mono" style={{ color: 'var(--fg-2)' }}>
                {l.pageId}
              </span>
            </div>
          )}
          {l.instagramBusinessAccountId && (
            <div className="row gap-6" style={{ fontSize: 11 }}>
              <span className="meta">IG Business</span>
              <span className="mono" style={{ color: 'var(--fg-2)' }}>
                {l.instagramBusinessAccountId}
              </span>
            </div>
          )}
        </div>
      )}
      <div
        className="meta"
        style={{ fontSize: 11, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 4 }}
      >
        ↳ Inherits brand rules from {parentName} (parent)
      </div>
      <div className="row gap-6">
        <button className="btn sm" onClick={onOpen}>
          Open
        </button>
        <button className="btn ai sm" onClick={onAdStudio}>
          Ad Studio
        </button>
        <button className="btn ghost sm" onClick={onEdit}>
          Edit
        </button>
        <button className="btn ghost sm" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

function LocationForm({
  clientId,
  existing,
  onCancel,
  onSaved,
}: {
  clientId: string;
  existing: Location | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [adAccountId, setAdAccountId] = useState(existing?.adAccountId ?? '');
  const [pageId, setPageId] = useState(existing?.pageId ?? '');
  const [igAccountId, setIgAccountId] = useState(existing?.instagramBusinessAccountId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase not configured');
      return;
    }
    if (!name.trim() || !address.trim()) {
      setError('Name and address are required');
      return;
    }
    setSubmitting(true);
    setError(null);

    // Normalize the location page URL (accepts bigairusa.com/asheville).
    const trimmedUrl = url.trim();
    const normalizedUrl = trimmedUrl
      ? trimmedUrl.startsWith('http')
        ? trimmedUrl
        : `https://${trimmedUrl}`
      : null;

    const payload = {
      client_id: clientId,
      name: name.trim(),
      address: address.trim(),
      url: normalizedUrl,
      ad_account_id: normalizeAdAccountId(adAccountId) || null,
      page_id: pageId.trim() || null,
      instagram_business_account_id: igAccountId.trim() || null,
    };

    const locationId = existing?.id ?? `${slugify(name)}-${randomSuffix()}`;
    const result = existing
      ? await supabase.from('locations').update(payload).eq('id', existing.id)
      : await supabase.from('locations').insert({ ...payload, id: locationId });

    setSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    // A new or changed URL → pull that location's pages in the background,
    // tagged to the location, so its AI jobs are grounded in its own content.
    if (normalizedUrl && normalizedUrl !== (existing?.url ?? null)) {
      scrapeLocationPages(clientId, locationId, normalizedUrl);
    }
    onSaved();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card card-pad stack gap-10"
      style={{ minHeight: 180, padding: 16 }}
    >
      <div style={{ fontWeight: 500 }}>{existing ? 'Edit location' : 'Add location'}</div>
      <label className="stack gap-4">
        <span className="meta">Name</span>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Big Air — Burnsville"
          style={inputStyle}
          disabled={submitting}
        />
      </label>
      <label className="stack gap-4">
        <span className="meta">Address</span>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="14290 Plymouth Ave Burnsville MN"
          style={inputStyle}
          disabled={submitting}
        />
      </label>
      <label className="stack gap-4">
        <span className="meta">Location page URL (optional)</span>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="bigairusa.com/asheville"
          style={inputStyle}
          disabled={submitting}
        />
      </label>
      <label className="stack gap-4">
        <span className="meta">Meta Ad Account ID (optional)</span>
        <input
          type="text"
          value={adAccountId}
          onChange={(e) => setAdAccountId(e.target.value)}
          placeholder="act_1069387220952651"
          style={inputStyle}
          disabled={submitting}
        />
      </label>
      <label className="stack gap-4">
        <span className="meta">Facebook Page ID (optional)</span>
        <input
          type="text"
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          placeholder="1234567890"
          style={inputStyle}
          disabled={submitting}
        />
      </label>
      <label className="stack gap-4">
        <span className="meta">Instagram Business ID (optional)</span>
        <input
          type="text"
          value={igAccountId}
          onChange={(e) => setIgAccountId(e.target.value)}
          placeholder="17841400000000000"
          style={inputStyle}
          disabled={submitting}
        />
      </label>
      {error && (
        <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
          ⚠ {error}
        </div>
      )}
      <div className="row gap-6">
        <button type="submit" className="btn primary sm" disabled={submitting}>
          {submitting ? 'Saving…' : existing ? 'Save changes' : 'Save'}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--fg)',
  padding: '8px 10px',
  font: 'inherit',
  fontSize: 13,
};
