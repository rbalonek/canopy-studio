import { Icon } from '../../components/Icon';
import { Ring } from '../../components/Ring';
import { useQuery } from '../../data/context';
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

export function LocationsTab({ clientId, parentName }: Props) {
  const { data: locations, loading } = useQuery<Location[]>(
    (p) => p.listLocationsForClient(clientId),
    [clientId],
  );

  if (loading) {
    return <div className="meta">Loading…</div>;
  }

  return (
    <div className="grid grid-3 gap-16" style={{ gap: 16 }}>
      {(locations ?? []).map((l) => (
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

      <div
        className="card card-pad stack gap-8"
        style={{
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 180,
          cursor: 'pointer',
        }}
      >
        <Icon name="plus" size={24} />
        <span style={{ fontWeight: 500 }}>Add location</span>
        <span className="meta">Inherits brand rules from parent</span>
      </div>
    </div>
  );
}

