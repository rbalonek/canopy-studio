import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { Status } from '../../components/Status';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

type Ad = {
  id: string;
  ad_set_id: string;
  campaign_id: string;
  client_id: string;
  ad_account_id: string | null;
  name: string;
  status: string;
  mtd_spend: number;
  daily_spend: number;
  mtd_results: number;
  mtd_result_type: string | null;
  mtd_cost_per_result: number;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  creative_id: string | null;
  destination_url: string | null;
  headline: string | null;
  body: string | null;
  thumbnail_url: string | null;
  image_url: string | null;
  call_to_action: string | null;
  creative_raw: Record<string, unknown> | null;
  last_refreshed_at: string | null;
};

export function AdDetail() {
  const { id: clientId, campaignId, adSetId, adId } = useParams<{
    id: string;
    campaignId: string;
    adSetId: string;
    adId: string;
  }>();
  const workspace = useWorkspace();
  const [ad, setAd] = useState<Ad | null | undefined>(undefined);
  const [clientName, setClientName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [adSetName, setAdSetName] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!supabase || !adId) {
      setAd(null);
      return;
    }
    supabase
      .from('ads')
      .select('*')
      .eq('id', adId)
      .maybeSingle()
      .then(({ data }) => setAd((data as unknown as Ad | null) ?? null));

    if (clientId) {
      supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .maybeSingle()
        .then(({ data }) => setClientName((data?.name as string) ?? ''));
    }
    if (campaignId) {
      supabase
        .from('campaigns')
        .select('name')
        .eq('id', campaignId)
        .maybeSingle()
        .then(({ data }) => setCampaignName((data?.name as string) ?? ''));
    }
    if (adSetId) {
      supabase
        .from('ad_sets')
        .select('name')
        .eq('id', adSetId)
        .maybeSingle()
        .then(({ data }) => setAdSetName((data?.name as string) ?? ''));
    }
  }, [clientId, campaignId, adSetId, adId]);

  if (ad === undefined) {
    return <div className="content wide"><span className="meta">Loading…</span></div>;
  }
  if (!ad) {
    return (
      <div className="content wide">
        <div className="card card-pad stack gap-8">
          <span className="h2">Ad not found</span>
        </div>
      </div>
    );
  }

  const prefix = workspace ? `/app/${workspace.slug}` : '/dev';
  const previewImg = ad.thumbnail_url || ad.image_url;

  return (
    <div className="content wide">
      <div className="row gap-8 meta" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
        <Link to={`${prefix}/clients`} style={{ color: 'inherit', textDecoration: 'none' }}>
          Clients
        </Link>
        <span>/</span>
        <Link
          to={`${prefix}/clients/${clientId}`}
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {clientName || 'Client'}
        </Link>
        <span>/</span>
        <Link
          to={`${prefix}/clients/${clientId}/campaigns/${campaignId}`}
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {campaignName || 'Campaign'}
        </Link>
        <span>/</span>
        <Link
          to={`${prefix}/clients/${clientId}/campaigns/${campaignId}/adsets/${adSetId}`}
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {adSetName || 'Ad set'}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>{ad.name}</span>
      </div>

      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="stack gap-4">
          <h1 className="h0" style={{ fontSize: 24 }}>
            {ad.name}
          </h1>
          <div className="row gap-8 meta">
            <Status s={mapStatus(ad.status)} />
            {ad.call_to_action && <span>·</span>}
            {ad.call_to_action && <span>CTA: {ad.call_to_action}</span>}
            {ad.creative_id && <span>·</span>}
            {ad.creative_id && (
              <span className="mono" style={{ fontSize: 11 }}>
                creative {ad.creative_id}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Creative preview + setup */}
      <div className="card card-pad stack gap-12" style={{ marginBottom: 16 }}>
        <span className="h2">Creative</span>
        <div className="row gap-16" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {previewImg ? (
            <a
              href={previewImg}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                width: 240,
                minWidth: 240,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--border)',
              }}
              title="Open full-size image in new tab"
            >
              <img
                src={previewImg}
                alt={ad.name}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </a>
          ) : (
            <div
              className="ph"
              style={{ width: 240, height: 240, minWidth: 240, borderRadius: 8 }}
            >
              No image
            </div>
          )}
          <div className="stack gap-12" style={{ flex: 1, minWidth: 280 }}>
            <Field label="Destination URL">
              {ad.destination_url ? (
                <a
                  href={ad.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: 'var(--accent)',
                    wordBreak: 'break-all',
                    fontSize: 13,
                  }}
                >
                  {ad.destination_url}
                </a>
              ) : (
                <span className="meta">—</span>
              )}
            </Field>
            <Field label="Headline">
              <span style={{ fontSize: 13 }}>{ad.headline || '—'}</span>
            </Field>
            <Field label="Body">
              <span style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{ad.body || '—'}</span>
            </Field>
            <Field label="Call to action">
              <span style={{ fontSize: 13 }}>{ad.call_to_action || '—'}</span>
            </Field>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        <Stat label="MTD spend" value={`$${fmt(ad.mtd_spend)}`} />
        <Stat
          label={`MTD results${ad.mtd_result_type ? ` (${ad.mtd_result_type})` : ''}`}
          value={fmt(ad.mtd_results, 0)}
        />
        <Stat
          label="MTD cost / result"
          value={ad.mtd_results > 0 ? `$${fmt(ad.mtd_cost_per_result)}` : '—'}
        />
        <Stat label="Yesterday spend" value={`$${fmt(ad.daily_spend)}`} />
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        <Stat label="Impressions" value={fmt(ad.impressions, 0)} />
        <Stat label="Clicks" value={fmt(ad.clicks, 0)} />
        <Stat label="CTR" value={`${fmt(ad.ctr)}%`} />
        <Stat label="CPC" value={`$${fmt(ad.cpc)}`} />
      </div>

      {/* Escape hatch: full Meta payload */}
      {ad.creative_raw && (
        <div className="card card-pad stack gap-8">
          <div className="row between">
            <span className="h2">Raw creative payload</span>
            <button className="btn ghost sm" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? 'Hide' : 'Show'}
            </button>
          </div>
          {showRaw && (
            <pre
              className="mono"
              style={{
                fontSize: 11,
                background: 'var(--bg-1)',
                padding: 12,
                borderRadius: 6,
                overflowX: 'auto',
                maxHeight: 360,
              }}
            >
              {JSON.stringify(ad.creative_raw, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stack gap-2">
      <span className="meta">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card card-pad stack gap-4">
      <span className="meta">{label}</span>
      <span style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

function fmt(n: number | string | null | undefined, digits = 2): string {
  const v = typeof n === 'string' ? parseFloat(n) : (n ?? 0);
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function mapStatus(s: string): 'Active' | 'Paused' | 'Draft' | 'Error' {
  switch (s) {
    case 'ACTIVE':
      return 'Active';
    case 'PAUSED':
      return 'Paused';
    case 'ARCHIVED':
    case 'DELETED':
      return 'Draft';
    default:
      return 'Error';
  }
}
