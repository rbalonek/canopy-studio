import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { Status } from '../../components/Status';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

type AdSet = {
  id: string;
  campaign_id: string;
  client_id: string;
  ad_account_id: string | null;
  name: string;
  status: string;
  optimization_goal: string | null;
  mtd_spend: number;
  daily_spend: number;
  mtd_results: number;
  mtd_result_type: string | null;
  mtd_cost_per_result: number;
  impressions: number;
  clicks: number;
  ctr: number;
  last_refreshed_at: string | null;
};

type AdRow = {
  id: string;
  name: string;
  status: string;
  mtd_spend: number;
  daily_spend: number;
  mtd_results: number;
  mtd_cost_per_result: number;
};

export function AdSetDetail() {
  const { id: clientId, campaignId, adSetId } = useParams<{
    id: string;
    campaignId: string;
    adSetId: string;
  }>();
  const workspace = useWorkspace();
  const [adSet, setAdSet] = useState<AdSet | null | undefined>(undefined);
  const [ads, setAds] = useState<AdRow[] | null>(null);
  const [clientName, setClientName] = useState('');
  const [campaignName, setCampaignName] = useState('');

  useEffect(() => {
    if (!supabase || !adSetId) {
      setAdSet(null);
      return;
    }
    supabase
      .from('ad_sets')
      .select(
        'id, campaign_id, client_id, ad_account_id, name, status, optimization_goal, mtd_spend, daily_spend, mtd_results, mtd_result_type, mtd_cost_per_result, impressions, clicks, ctr, last_refreshed_at',
      )
      .eq('id', adSetId)
      .maybeSingle()
      .then(({ data }) => setAdSet((data as AdSet | null) ?? null));

    supabase
      .from('ads')
      .select('id, name, status, mtd_spend, daily_spend, mtd_results, mtd_cost_per_result')
      .eq('ad_set_id', adSetId)
      .order('mtd_spend', { ascending: false })
      .then(({ data }) =>
        setAds(
          (data ?? []).map((r) => ({
            id: r.id as string,
            name: r.name as string,
            status: r.status as string,
            mtd_spend: parseFloat(String(r.mtd_spend ?? 0)) || 0,
            daily_spend: parseFloat(String(r.daily_spend ?? 0)) || 0,
            mtd_results: parseFloat(String(r.mtd_results ?? 0)) || 0,
            mtd_cost_per_result: parseFloat(String(r.mtd_cost_per_result ?? 0)) || 0,
          })),
        ),
      );

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
  }, [clientId, campaignId, adSetId]);

  if (adSet === undefined) {
    return <div className="content wide"><span className="meta">Loading…</span></div>;
  }
  if (!adSet) {
    return (
      <div className="content wide">
        <div className="card card-pad stack gap-8">
          <span className="h2">Ad set not found</span>
        </div>
      </div>
    );
  }

  const prefix = workspace ? `/app/${workspace.slug}` : '/dev';
  const clientPath = `${prefix}/clients/${clientId}`;
  const campaignPath = `${prefix}/clients/${clientId}/campaigns/${campaignId}`;

  return (
    <div className="content wide">
      <div className="row gap-8 meta" style={{ marginBottom: 8 }}>
        <Link to={`${prefix}/clients`} style={{ color: 'inherit', textDecoration: 'none' }}>
          Clients
        </Link>
        <span>/</span>
        <Link to={clientPath} style={{ color: 'inherit', textDecoration: 'none' }}>
          {clientName || 'Client'}
        </Link>
        <span>/</span>
        <Link to={campaignPath} style={{ color: 'inherit', textDecoration: 'none' }}>
          {campaignName || 'Campaign'}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>{adSet.name}</span>
      </div>

      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="stack gap-4">
          <h1 className="h0" style={{ fontSize: 24 }}>
            {adSet.name}
          </h1>
          <div className="row gap-8 meta">
            <Status s={mapStatus(adSet.status)} />
            {adSet.optimization_goal && <span>·</span>}
            {adSet.optimization_goal && (
              <span className="meta">{adSet.optimization_goal}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        <Stat label="MTD spend" value={`$${fmt(adSet.mtd_spend)}`} />
        <Stat
          label={`MTD results${adSet.mtd_result_type ? ` (${adSet.mtd_result_type})` : ''}`}
          value={fmt(adSet.mtd_results, 0)}
        />
        <Stat
          label="MTD cost / result"
          value={adSet.mtd_results > 0 ? `$${fmt(adSet.mtd_cost_per_result)}` : '—'}
        />
        <Stat label="Yesterday spend" value={`$${fmt(adSet.daily_spend)}`} />
      </div>

      <AdsTable ads={ads} />
    </div>
  );
}

function AdsTable({ ads }: { ads: AdRow[] | null }) {
  if (ads === null) return <div className="meta">Loading ads…</div>;
  if (ads.length === 0) {
    return (
      <div
        className="card card-pad stack gap-6"
        style={{ borderStyle: 'dashed', textAlign: 'center', padding: 32 }}
      >
        <span style={{ fontWeight: 500 }}>No ads yet</span>
        <span className="meta" style={{ fontSize: 12 }}>
          Hit Refresh META on the client to pull this ad set's ads.
        </span>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="h2">Ads</span>
        <span className="meta">
          {ads.length} {ads.length === 1 ? 'ad' : 'ads'} · MTD
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>MTD Spend</th>
              <th style={{ textAlign: 'right' }}>MTD Results</th>
              <th style={{ textAlign: 'right' }}>Cost / result</th>
              <th style={{ textAlign: 'right' }}>Yesterday</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{a.name}</td>
                <td>
                  <Status s={mapStatus(a.status)} />
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${fmt(a.mtd_spend)}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(a.mtd_results, 0)}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {a.mtd_results > 0 ? `$${fmt(a.mtd_cost_per_result)}` : '—'}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ${fmt(a.daily_spend)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
