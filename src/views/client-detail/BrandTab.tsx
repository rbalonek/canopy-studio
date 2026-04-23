import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type { BrandProfile } from '../../data/types';

export function BrandTab({ clientId }: { clientId: string }) {
  const { data: brand, loading } = useQuery<BrandProfile | null>(
    (p) => p.getBrandProfile(clientId),
    [clientId],
  );

  if (loading) {
    return <div className="meta">Loading…</div>;
  }

  if (!brand) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
      >
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="sparkles" size={32} />
        </div>
        <div className="h2">No brand profile yet</div>
        <div className="meta" style={{ maxWidth: 360 }}>
          Add a description, voice, and do's/don'ts so AI-generated content stays on-brand.
        </div>
        <button className="btn primary">
          <Icon name="plus" size={13} /> Create brand profile
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
      <div className="card card-pad stack gap-12">
        <span className="h2">Company description</span>
        <div
          className="ph"
          style={{
            minHeight: 80,
            padding: 12,
            textAlign: 'left',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          }}
        >
          {brand.description}
        </div>
      </div>

      <div className="card card-pad stack gap-12">
        <span className="h2">Brand voice</span>
        <div
          className="ph"
          style={{
            minHeight: 80,
            padding: 12,
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            textAlign: 'left',
          }}
        >
          {brand.voice}
        </div>
      </div>

      <div className="card card-pad stack gap-12">
        <span className="h2">Do's</span>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-1)' }}>
          {brand.dos.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      <div className="card card-pad stack gap-12">
        <span className="h2">Don'ts</span>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-1)' }}>
          {brand.donts.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      <div className="card card-pad stack gap-12" style={{ gridColumn: '1/-1' }}>
        <div className="row between">
          <span className="h2">Logo</span>
          <button className="btn sm">
            <Icon name="upload" size={12} /> Upload new
          </button>
        </div>
        <div className="ph" style={{ height: 120, borderRadius: 8 }}>
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt="logo" style={{ maxHeight: 100 }} />
          ) : (
            'Drag + drop logo (SVG, PNG)'
          )}
        </div>
      </div>
    </div>
  );
}
