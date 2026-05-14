import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { Ring } from '../../components/Ring';
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

export function LocationsTab({ clientId, parentName }: Props) {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[] | null>(null);
  // null = closed; 'new' = adding; <id> = editing that location
  const [formState, setFormState] = useState<'new' | string | null>(null);

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
            onOpen={() => openLocation(l)}
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
  );
}

function LocationCard({
  location: l,
  parentName,
  onOpen,
  onEdit,
  onDelete,
}: {
  location: Location;
  parentName: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="card card-pad stack gap-10">
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
        <button className="btn sm" onClick={onOpen}>
          Open
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

    const payload = {
      client_id: clientId,
      name: name.trim(),
      address: address.trim(),
      ad_account_id: normalizeAdAccountId(adAccountId) || null,
      page_id: pageId.trim() || null,
      instagram_business_account_id: igAccountId.trim() || null,
    };

    const result = existing
      ? await supabase.from('locations').update(payload).eq('id', existing.id)
      : await supabase
          .from('locations')
          .insert({ ...payload, id: `${slugify(name)}-${randomSuffix()}` });

    setSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
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
