import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../auth/supabaseClient';
import { Status } from '../../components/Status';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

type Campaign = {
  id: string;
  client_id: string;
  ad_account_id: string | null;
  name: string;
  status: string;
  objective: string | null;
  strategy: string | null;
  mtd_spend: number;
  daily_spend: number;
  mtd_results: number;
  mtd_result_type: string | null;
  mtd_cost_per_result: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  last_refreshed_at: string | null;
};

type AdSetRow = {
  id: string;
  name: string;
  status: string;
  optimization_goal: string | null;
  mtd_spend: number;
  daily_spend: number;
  mtd_results: number;
  mtd_cost_per_result: number;
};

export function CampaignDetail() {
  const { id: clientId, campaignId } = useParams<{ id: string; campaignId: string }>();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const [campaign, setCampaign] = useState<Campaign | null | undefined>(undefined);
  const [adSets, setAdSets] = useState<AdSetRow[] | null>(null);
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    if (!supabase || !campaignId) {
      setCampaign(null);
      return;
    }
    supabase
      .from('campaigns')
      .select(
        'id, client_id, ad_account_id, name, status, objective, strategy, mtd_spend, daily_spend, mtd_results, mtd_result_type, mtd_cost_per_result, impressions, clicks, ctr, cpc, cpm, roas, last_refreshed_at',
      )
      .eq('id', campaignId)
      .maybeSingle()
      .then(({ data }) => setCampaign((data as Campaign | null) ?? null));

    supabase
      .from('ad_sets')
      .select(
        'id, name, status, optimization_goal, mtd_spend, daily_spend, mtd_results, mtd_cost_per_result',
      )
      .eq('campaign_id', campaignId)
      .order('mtd_spend', { ascending: false })
      .then(({ data }) =>
        setAdSets(
          (data ?? []).map((r) => ({
            id: r.id as string,
            name: r.name as string,
            status: r.status as string,
            optimization_goal: (r.optimization_goal as string | null) ?? null,
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
  }, [clientId, campaignId]);

  if (campaign === undefined) {
    return <div className="content wide"><span className="meta">Loading…</span></div>;
  }
  if (!campaign) {
    return (
      <div className="content wide">
        <div className="card card-pad stack gap-8">
          <span className="h2">Campaign not found</span>
        </div>
      </div>
    );
  }

  const prefix = workspace ? `/app/${workspace.slug}` : '/dev';
  const clientPath = `${prefix}/clients/${clientId}`;

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
        <span style={{ color: 'var(--fg)' }}>{campaign.name}</span>
      </div>

      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="stack gap-4">
          <h1 className="h0" style={{ fontSize: 24 }}>
            {campaign.name}
          </h1>
          <div className="row gap-8 meta">
            <Status s={mapStatus(campaign.status)} />
            {campaign.strategy && <span>·</span>}
            {campaign.strategy && <span>{campaign.strategy}</span>}
            {campaign.objective && <span>·</span>}
            {campaign.objective && (
              <span className="mono" style={{ fontSize: 11 }}>
                {campaign.objective}
              </span>
            )}
            {campaign.ad_account_id && <span>·</span>}
            {campaign.ad_account_id && (
              <span className="mono" style={{ fontSize: 11 }}>
                {campaign.ad_account_id}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 16 }}>
        <Stat label="MTD spend" value={`$${fmt(campaign.mtd_spend)}`} />
        <Stat
          label={`MTD results${campaign.mtd_result_type ? ` (${campaign.mtd_result_type})` : ''}`}
          value={fmt(campaign.mtd_results, 0)}
        />
        <Stat
          label="MTD cost / result"
          value={campaign.mtd_results > 0 ? `$${fmt(campaign.mtd_cost_per_result)}` : '—'}
        />
        <Stat label="Yesterday spend" value={`$${fmt(campaign.daily_spend)}`} />
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 24 }}>
        <Stat label="Impressions" value={fmt(campaign.impressions, 0)} />
        <Stat label="Clicks" value={fmt(campaign.clicks, 0)} />
        <Stat label="CTR" value={`${fmt(campaign.ctr)}%`} />
        <Stat label="ROAS" value={campaign.roas > 0 ? `${fmt(campaign.roas)}×` : '—'} />
      </div>

      <AdSetsTable
        adSets={adSets}
        onOpen={(id) => navigate(`${prefix}/clients/${clientId}/campaigns/${campaignId}/adsets/${id}`)}
      />
    </div>
  );
}

function AdSetsTable({
  adSets,
  onOpen,
}: {
  adSets: AdSetRow[] | null;
  onOpen: (id: string) => void;
}) {
  if (adSets === null) return <div className="meta">Loading ad sets…</div>;
  if (adSets.length === 0) {
    return (
      <div
        className="card card-pad stack gap-6"
        style={{ borderStyle: 'dashed', textAlign: 'center', padding: 32 }}
      >
        <span style={{ fontWeight: 500 }}>No ad sets yet</span>
        <span className="meta" style={{ fontSize: 12 }}>
          Hit <strong>Refresh META</strong> on this client to pull the campaign's ad sets + ads.
        </span>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="h2">Ad sets</span>
        <span className="meta">
          {adSets.length} {adSets.length === 1 ? 'set' : 'sets'} · MTD
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Optimization</th>
              <th style={{ textAlign: 'right' }}>MTD Spend</th>
              <th style={{ textAlign: 'right' }}>MTD Results</th>
              <th style={{ textAlign: 'right' }}>Cost / result</th>
              <th style={{ textAlign: 'right' }}>Yesterday</th>
            </tr>
          </thead>
          <tbody>
            {adSets.map((a) => (
              <tr key={a.id} onClick={() => onOpen(a.id)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 500 }}>{a.name}</td>
                <td>
                  <Status s={mapStatus(a.status)} />
                </td>
                <td className="meta" style={{ fontSize: 12 }}>
                  {a.optimization_goal ?? '—'}
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
