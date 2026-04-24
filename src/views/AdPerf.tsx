import { useMemo, useState } from 'react';
import { AIBadge } from '../components/AIBadge';
import { AreaChart } from '../components/AreaChart';
import { Delta } from '../components/Delta';
import { DeltaSpark } from '../components/DeltaSpark';
import { Icon } from '../components/Icon';
import { Status } from '../components/Status';
import { Strategy } from '../components/Strategy';
import { useQuery } from '../data/context';
import type { AdInsight, AdPerfTreeNode, CampaignDetail } from '../data/types';

const PERIODS = ['Yesterday', '7d', '30d', 'MTD', 'QTD', 'Custom'] as const;
const FILTERS = ['Strategy: All', 'Status: Active', 'Spend > $500', 'Has conversions'];

const INSIGHT_PILL: Record<AdInsight['accent'], string> = {
  red: 'red',
  amber: 'amber',
  green: 'green',
};

export function AdPerf() {
  const { data: tree } = useQuery<AdPerfTreeNode[]>((p) => p.listAdPerfTree());
  const [selectedNodeId, setSelectedNodeId] = useState<string>('n_cmp_82910');

  const selectedCampaignId = useMemo(() => {
    const node = tree?.find((n) => n.id === selectedNodeId);
    return node?.campaignId ?? 'cmp_82910';
  }, [tree, selectedNodeId]);

  const { data: campaign, loading: campaignLoading } = useQuery<CampaignDetail | null>(
    (p) => p.getCampaignDetail(selectedCampaignId),
    [selectedCampaignId],
  );

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <h1 className="h0">Ad Performance</h1>
        <div className="row gap-8">
          <button className="btn ghost">
            <Icon name="refresh" size={13} /> Refresh from META
          </button>
          <button className="btn ai">
            <Icon name="sparkles" size={13} /> AI analyze
          </button>
        </div>
      </div>

      <div className="row gap-8" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <span className="meta">Filters:</span>
        {FILTERS.map((c) => (
          <span key={c} className="pill">
            {c}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <a className="meta" style={{ color: 'var(--accent)', fontSize: 12 }}>
          Excluded accounts (7) →
        </a>
      </div>

      <div className="grid gap-16" style={{ gridTemplateColumns: '280px 1fr', gap: 16 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 500 }}>Hierarchy</span>
            <Icon name="search" size={13} />
          </div>
          <div className="stack" style={{ padding: 8, fontSize: 13 }}>
            {(tree ?? []).map((r) => {
              const isActive = r.id === selectedNodeId;
              return (
                <div
                  key={r.id}
                  className={`tree-node ${isActive ? 'on' : ''}`}
                  style={{ paddingLeft: 6 + r.lvl * 14 }}
                  onClick={() => setSelectedNodeId(r.id)}
                >
                  <span className="caret">{r.lvl < 4 ? '▸' : '·'}</span>
                  {r.icon && <Icon name={r.icon} size={12} />}
                  <span
                    className={r.mono ? 'mono' : ''}
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: r.mono ? 11 : 13,
                    }}
                  >
                    {r.label}
                  </span>
                  <span className="sp">{r.spend}</span>
                </div>
              );
            })}
          </div>
        </div>

        {campaignLoading ? (
          <div className="meta">Loading…</div>
        ) : !campaign ? (
          <div className="card card-pad stack gap-8">
            <span className="h2">No detail for this campaign yet</span>
            <span className="meta">
              Select a populated campaign in the tree (try "Leads | ASO | Group Events").
            </span>
          </div>
        ) : (
          <CampaignPanel campaign={campaign} />
        )}
      </div>
    </div>
  );
}

function CampaignPanel({ campaign }: { campaign: CampaignDetail }) {
  return (
    <div className="stack gap-16">
      <div className="card">
        <div className="card-pad stack gap-8" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="row between">
            <div className="stack gap-4">
              <div className="row gap-8">
                <span className="h2">{campaign.name}</span>
                <Strategy s={campaign.strategy} />
                <Status s={campaign.status} />
              </div>
              <div className="row gap-8 meta">
                <span className="mono">{campaign.id}</span>·<span>{campaign.clientName}</span>·
                <span>Last refresh {campaign.lastRefreshLabel}</span>
              </div>
            </div>
            <div className="row gap-8">
              <button className="btn ghost sm">
                <Icon name="refresh" size={12} /> Refresh
              </button>
              <button className="btn ai sm">
                <Icon name="sparkles" size={12} /> AI analyze
              </button>
            </div>
          </div>
          <div className="seg">
            {PERIODS.map((p) => (
              <button key={p} className={p === 'MTD' ? 'on' : ''}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(6,1fr)',
            gap: 1,
            background: 'var(--border)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {campaign.kpis.map((k) => (
            <div key={k.label} className="stack gap-4" style={{ background: 'var(--bg-1)', padding: 12 }}>
              <div className="row between">
                <span className="meta" style={{ fontSize: 11 }}>
                  {k.label}
                </span>
                <Delta v={k.delta} neutral={k.delta === 0} />
              </div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 17,
                  letterSpacing: '-0.01em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {k.value}
              </div>
              {k.delta !== 0 ? (
                <DeltaSpark seed={k.seed} up={k.delta >= 0} w={120} h={22} />
              ) : (
                <div className="row gap-2" style={{ marginTop: 2 }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      style={{
                        flex: 1,
                        height: 4,
                        background: j < 3 ? 'var(--accent)' : 'var(--bg-2)',
                        borderRadius: 1,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: 16 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>Spend + Conversions</span>
            <div className="row gap-8">
              <label className="row gap-4 meta">
                <input type="checkbox" defaultChecked /> Prior period
              </label>
              <label className="row gap-4 meta">
                <input type="checkbox" /> Siblings
              </label>
            </div>
          </div>
          <AreaChart h={200} seeds={[1, 4]} colors={['var(--accent)', 'var(--ai)']} />
          <div
            className="row gap-16"
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid var(--border)',
            }}
          >
            <div className="row gap-6" style={{ fontSize: 12 }}>
              <span
                style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }}
              />
              <span>Spend</span>
              <span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {campaign.kpis.find((k) => k.label === 'Spend')?.value} MTD
              </span>
            </div>
            <div className="row gap-6" style={{ fontSize: 12 }}>
              <span
                style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--ai)', display: 'inline-block' }}
              />
              <span>Conversions</span>
              <span className="meta" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {campaign.kpis.find((k) => k.label === 'Conversions')?.value} MTD
              </span>
            </div>
          </div>
        </div>
      </div>

      {campaign.insights.length > 0 && (
        <div className="ai-surface">
          <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="row gap-8">
              <span className="h2">AI Analysis</span>
              <AIBadge />
            </div>
            <Icon name="chevd" size={14} />
          </div>
          <div className="stack" style={{ padding: 12, gap: 10 }}>
            {campaign.insights.map((ins, i) => (
              <div
                key={i}
                className={`card card-pad stack gap-6 bdr-${ins.accent}`}
                style={{ background: 'var(--bg-2)' }}
              >
                <div className="row gap-8">
                  <span className={`pill ${INSIGHT_PILL[ins.accent]}`}>
                    <span className="dot" />
                    {ins.priority}
                  </span>
                  <span style={{ fontWeight: 500 }}>{ins.title}</span>
                </div>
                <div className="meta">{ins.body}</div>
                {ins.actions.length > 0 && (
                  <div className="row gap-8">
                    {ins.actions.map((a) => (
                      <button
                        key={a.label}
                        className={`btn ${a.style === 'ai' ? 'ai' : a.style === 'ghost' ? 'ghost' : ''} sm`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Ad sets</span>
          <span className="meta">{campaign.adSets.length} · ranked by spend</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Spend</th>
              <th>Conv.</th>
              <th>CPL</th>
              <th>CTR</th>
              <th>Trend</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {campaign.adSets.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="mono" style={{ color: 'var(--fg-2)' }}>
                  {r.id}
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.spend}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.conv}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <div className="row gap-8" style={{ alignItems: 'center' }}>
                    <span style={{ minWidth: 36 }}>{r.cpl}</span>
                    {r.cplPct > 0 && (
                      <div style={{ width: 60, height: 6, background: 'var(--bg-2)', borderRadius: 99 }}>
                        <div
                          style={{
                            width: `${r.cplPct}%`,
                            height: '100%',
                            background: r.cplPct > 70 ? 'var(--amber)' : 'var(--accent)',
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.ctr}</td>
                <td>
                  <DeltaSpark seed={r.sparkSeed} up={r.trendUp} w={70} h={20} />
                </td>
                <td>
                  <Status s={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
