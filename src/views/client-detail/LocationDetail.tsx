import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { Ring } from '../../components/Ring';
import type { Location } from '../../data/types';
import { useWorkspace } from '../../workspace/WorkspaceProvider';
import { CampaignsTable } from '../campaigns/CampaignsTable';

/**
 * Per-location detail page. A location is essentially a sub-client —
 * it has its own Meta ad account, FB Page, IG Business account, and
 * (eventually) its own campaign performance under those rooflines.
 *
 * For now this view does the minimum useful thing: show the saved IDs,
 * support editing the location, and run "Refresh META" scoped to just
 * this location's ad account (so the user doesn't have to refresh
 * every location when they only changed one).
 */
export function LocationDetail() {
  const { id: clientId, locId } = useParams<{ id: string; locId: string }>();
  const workspace = useWorkspace();
  const navigate = useNavigate();

  const [location, setLocation] = useState<Location | null | undefined>(undefined);
  const [parentName, setParentName] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function refresh() {
    if (!supabase || !locId) {
      setLocation(null);
      return;
    }
    const { data, error } = await supabase
      .from('locations')
      .select(
        'id, name, address, mtd_spend, active_campaigns, posts_per_week, complete, page_id, instagram_business_account_id, ad_account_id, client_id',
      )
      .eq('id', locId)
      .maybeSingle();
    if (error || !data) {
      setLocation(null);
      return;
    }
    setLocation({
      id: data.id as string,
      name: data.name as string,
      address: data.address as string,
      mtdSpend: data.mtd_spend as string,
      activeCampaigns: data.active_campaigns as number,
      postsPerWeek: data.posts_per_week as number,
      complete: data.complete as number,
      pageId: (data.page_id as string | null) ?? null,
      instagramBusinessAccountId: (data.instagram_business_account_id as string | null) ?? null,
      adAccountId: (data.ad_account_id as string | null) ?? null,
    });
    // Parent client name for the breadcrumb
    const { data: c } = await supabase
      .from('clients')
      .select('name')
      .eq('id', data.client_id as string)
      .maybeSingle();
    setParentName((c?.name as string) ?? '');
  }

  useEffect(() => {
    setLocation(undefined);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locId]);

  async function onRefreshMeta() {
    if (!supabase || !clientId || !locId) return;
    setRefreshing(true);
    setRefreshMsg(null);
    const { data, error } = await supabase.functions.invoke('meta-refresh-client', {
      body: { client_id: clientId, location_id: locId },
    });
    setRefreshing(false);
    if (error) {
      setRefreshMsg({ kind: 'err', text: error.message });
      return;
    }
    if (!data?.ok) {
      const detail = data?.errors?.length ? `: ${data.errors.join('; ')}` : '';
      setRefreshMsg({ kind: 'err', text: (data?.error ?? 'Refresh failed') + detail });
      return;
    }
    setRefreshMsg({
      kind: 'ok',
      text: `Refreshed ${data.refreshed ?? 0} campaigns from ${data.attempted?.[0] ?? 'Meta'}.`,
    });
  }

  async function onDelete() {
    if (!supabase || !location || !clientId) return;
    if (!confirm(`Delete location "${location.name}"? This can't be undone.`)) return;
    await supabase.from('locations').delete().eq('id', location.id);
    const prefix = workspace ? `/app/${workspace.slug}` : '/dev';
    navigate(`${prefix}/clients/${clientId}`);
  }

  if (location === undefined) {
    return (
      <div className="content wide">
        <span className="meta">Loading…</span>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="content wide">
        <div className="card card-pad stack gap-8">
          <span className="h2">Location not found</span>
          <span className="meta">No location with id "{locId}".</span>
        </div>
      </div>
    );
  }

  const prefix = workspace ? `/app/${workspace.slug}` : '/dev';
  const clientPath = `${prefix}/clients/${clientId}`;
  const initials = location.name
    .split(/[—\s]+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  return (
    <div className="content wide">
      <div className="row gap-8 meta" style={{ marginBottom: 8 }}>
        <Link to={`${prefix}/clients`} style={{ color: 'inherit', textDecoration: 'none' }}>
          Clients
        </Link>
        <span>/</span>
        <Link to={clientPath} style={{ color: 'inherit', textDecoration: 'none' }}>
          {parentName || 'Client'}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>{location.name}</span>
      </div>

      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="row gap-12">
          <div
            className="logo-mark"
            style={{ width: 44, height: 44, fontSize: 18, borderRadius: 10 }}
          >
            {initials.toUpperCase()}
          </div>
          <div className="stack gap-4">
            <h1 className="h0">{location.name}</h1>
            <span className="meta">{location.address}</span>
          </div>
        </div>
        <div className="row gap-8">
          <button
            className="btn ghost"
            onClick={onRefreshMeta}
            disabled={refreshing || !location.adAccountId}
            title={!location.adAccountId ? 'Set a Meta ad account ID first' : undefined}
          >
            <Icon name="refresh" size={14} />
            {refreshing ? ' Refreshing…' : ' Refresh META'}
          </button>
          <button className="btn ghost" onClick={() => setEditing(true)}>
            <Icon name="link" size={14} /> Edit
          </button>
          <button className="btn ghost" onClick={onDelete}>
            Delete
          </button>
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

      <div className="card card-pad stack gap-12">
        <div className="row gap-16">
          <div className="stack gap-2" style={{ minWidth: 200 }}>
            <span className="meta">Meta Ad Account</span>
            <span className="mono" style={{ fontSize: 13 }}>
              {location.adAccountId || '—'}
            </span>
          </div>
          <div className="stack gap-2" style={{ minWidth: 200 }}>
            <span className="meta">FB Page ID</span>
            <span className="mono" style={{ fontSize: 13 }}>
              {location.pageId || '—'}
            </span>
          </div>
          <div className="stack gap-2">
            <span className="meta">IG Business ID</span>
            <span className="mono" style={{ fontSize: 13 }}>
              {location.instagramBusinessAccountId || '—'}
            </span>
          </div>
        </div>
        <div className="row gap-24" style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div className="stack gap-2">
            <span className="meta">Spend MTD</span>
            <span style={{ fontWeight: 500, fontSize: 18 }}>{location.mtdSpend}</span>
          </div>
          <div className="stack gap-2">
            <span className="meta">Active campaigns</span>
            <span style={{ fontWeight: 500, fontSize: 18 }}>{location.activeCampaigns}</span>
          </div>
          <div className="stack gap-2">
            <span className="meta">Posts / wk</span>
            <span style={{ fontWeight: 500, fontSize: 18 }}>{location.postsPerWeek}</span>
          </div>
          <div className="stack gap-2">
            <span className="meta">Brand completeness</span>
            <Ring p={location.complete} />
          </div>
        </div>
      </div>

      {editing && (
        <EditLocationForm
          location={location}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      )}

      {location.adAccountId && (
        <div style={{ marginTop: 16 }}>
          <CampaignsTable adAccountId={location.adAccountId} />
        </div>
      )}

      <div className="meta" style={{ fontSize: 11, marginTop: 16 }}>
        Posts, brand intelligence, and ad-set / ad drill-downs for this location will appear here
        once we port more of the Meta + scraping pipeline.
      </div>
    </div>
  );
}

function EditLocationForm({
  location,
  onCancel,
  onSaved,
}: {
  location: Location;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address);
  const [adAccountId, setAdAccountId] = useState(location.adAccountId ?? '');
  const [pageId, setPageId] = useState(location.pageId ?? '');
  const [igAccountId, setIgAccountId] = useState(location.instagramBusinessAccountId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError(null);
    const normalize = (s: string) => s.replace(/\s+/g, '');
    const acct = normalize(adAccountId);
    const { error: dbErr } = await supabase
      .from('locations')
      .update({
        name: name.trim(),
        address: address.trim(),
        ad_account_id: acct ? (acct.startsWith('act_') ? acct : `act_${acct}`) : null,
        page_id: pageId.trim() || null,
        instagram_business_account_id: igAccountId.trim() || null,
      })
      .eq('id', location.id);
    setSubmitting(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad stack gap-12" style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 500 }}>Edit location</div>
      <div className="grid grid-2 gap-12">
        <label className="stack gap-4">
          <span className="meta">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            style={inputStyle}
            disabled={submitting}
          />
        </label>
        <label className="stack gap-4">
          <span className="meta">Meta Ad Account ID</span>
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
          <span className="meta">FB Page ID</span>
          <input
            type="text"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            style={inputStyle}
            disabled={submitting}
          />
        </label>
        <label className="stack gap-4">
          <span className="meta">IG Business ID</span>
          <input
            type="text"
            value={igAccountId}
            onChange={(e) => setIgAccountId(e.target.value)}
            style={inputStyle}
            disabled={submitting}
          />
        </label>
      </div>
      {error && (
        <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
          ⚠ {error}
        </div>
      )}
      <div className="row gap-6">
        <button type="submit" className="btn primary sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
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
