import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { Ring } from '../../components/Ring';
import type { Location } from '../../data/types';

type Props = {
  clientId: string;
  parentName: string;
};

function initialsFromLocationName(name: string): string {
  // "Acme Dental — Downtown" → "Do". Falls back to first 2 chars of the
  // whole name when there's no " — " separator.
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

export function LocationsTab({ clientId, parentName }: Props) {
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [adding, setAdding] = useState(false);

  async function refresh() {
    if (!supabase) {
      setLocations([]);
      return;
    }
    const { data, error } = await supabase
      .from('locations')
      .select(
        'id, name, address, mtd_spend, active_campaigns, posts_per_week, complete, page_id, instagram_business_account_id, ad_account_id',
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

  if (locations === null) {
    return <div className="meta">Loading…</div>;
  }

  return (
    <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
      {locations.map((l) => (
        <div key={l.id} className="card card-pad stack gap-10">
          <div className="row between">
            <div className="row gap-8">
              <div className="logo-mark" style={{ width: 28, height: 28, fontSize: 12 }}>
                {initialsFromLocationName(l.name)}
              </div>
              <div className="stack">
                <span style={{ fontWeight: 500, fontSize: 13 }}>{l.name}</span>
                <span className="meta">{l.address}</span>
              </div>
            </div>
            <Ring p={l.complete} />
          </div>
          <div className="row gap-16" style={{ paddingTop: 4 }}>
            <div className="stack">
              <span className="meta">Spend MTD</span>
              <span style={{ fontWeight: 500 }}>{l.mtdSpend}</span>
            </div>
            <div className="stack">
              <span className="meta">Campaigns</span>
              <span style={{ fontWeight: 500 }}>{l.activeCampaigns}</span>
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
            <button className="btn sm">Open</button>
            <button className="btn ghost sm">Edit brand overrides</button>
          </div>
        </div>
      ))}

      {adding ? (
        <AddLocationForm
          clientId={clientId}
          onCancel={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
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
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" size={24} />
          <span style={{ fontWeight: 500 }}>Add location</span>
          <span className="meta">Inherits brand rules from parent</span>
        </button>
      )}
    </div>
  );
}

function AddLocationForm({
  clientId,
  onCancel,
  onAdded,
}: {
  clientId: string;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [pageId, setPageId] = useState('');
  const [igAccountId, setIgAccountId] = useState('');
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

    const id = `${slugify(name)}-${randomSuffix()}`;
    const { error: dbErr } = await supabase.from('locations').insert({
      id,
      client_id: clientId,
      name: name.trim(),
      address: address.trim(),
      ad_account_id: adAccountId.trim() || null,
      page_id: pageId.trim() || null,
      instagram_business_account_id: igAccountId.trim() || null,
    });

    setSubmitting(false);
    if (dbErr) {
      setError(dbErr.message);
      return;
    }
    onAdded();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card card-pad stack gap-10"
      style={{ minHeight: 180, padding: 16 }}
    >
      <div style={{ fontWeight: 500 }}>Add location</div>
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
        <span className="meta" style={{ fontSize: 11 }}>
          Uses the parent client's Meta access token — these IDs scope which Page/IG account this
          location publishes to and pulls insights from.
        </span>
      </label>
      {error && (
        <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
          ⚠ {error}
        </div>
      )}
      <div className="row gap-6">
        <button type="submit" className="btn primary sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
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
