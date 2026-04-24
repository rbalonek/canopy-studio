import { useState } from 'react';
import { AIBadge } from '../../components/AIBadge';
import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type { BrandIntelligenceStats, BrandTakeaway } from '../../data/types';
import { CompareTab } from './CompareTab';
import { BrandCompetitorsTab } from './CompetitorsTab';
import { GapsAnglesTab } from './GapsAnglesTab';
import { WebsitesTab } from './WebsitesTab';

type TabId = 'competitors' | 'compare' | 'gaps & angles' | 'websites' | 'rules' | 'assets';

const TABS: TabId[] = ['competitors', 'compare', 'gaps & angles', 'websites', 'rules', 'assets'];

export function BrandIntelligence() {
  const { data: stats } = useQuery<BrandIntelligenceStats>((p) => p.getBrandIntelligenceStats());
  const { data: takeaway } = useQuery<BrandTakeaway>((p) => p.getBrandTakeaway());
  const [tab, setTab] = useState<TabId>('competitors');

  const heroCards = stats
    ? [
        { title: 'Website Intelligence',     value: `${stats.domains.count} domains`,       meta: `${stats.domains.pagesIndexed} pages indexed`,    icon: 'link' },
        { title: 'Competitor Intelligence',  value: `${stats.competitors.tracked} tracked`, meta: `${stats.competitors.newPagesThisWeek} new pages this week`, icon: 'brain', ai: true },
        { title: 'Brand Rules',              value: `${stats.rules.total} rules`,           meta: `${stats.rules.crossClient} cross-client`,         icon: 'check' },
        { title: 'Asset Library',            value: `${stats.assets.total} files`,          meta: `${stats.assets.aiAnalyzed} analyzed by AI`,       icon: 'image' },
      ]
    : [];

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4">
          <h1 className="h0">Brand Intelligence</h1>
          <span className="meta">Your sites, competitor sites, rules, and assets — one brain.</span>
        </div>
        <button className="btn primary">
          <Icon name="plus" size={13} /> Add competitor
        </button>
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, marginBottom: 20 }}>
        {heroCards.map((c) => (
          <div key={c.title} className={`card card-pad stack gap-6 ${c.ai ? 'ai-surface' : ''}`}>
            <div className="row between">
              <span className="meta">{c.title}</span>
              <Icon name={c.icon} size={14} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{c.value}</div>
            <span className="meta">{c.meta}</span>
          </div>
        ))}
      </div>

      {takeaway && (
        <div className="ai-surface card-pad row gap-12" style={{ marginBottom: 20 }}>
          <AIBadge />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>Claude's take</div>
            <div className="meta">{takeaway.body}</div>
          </div>
          <button className="btn ai sm">See all insights →</button>
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <div
            key={t}
            className={`tab ${tab === t ? 'on' : ''}`}
            onClick={() => setTab(t)}
            style={{ textTransform: 'capitalize' }}
          >
            {t}
          </div>
        ))}
      </div>

      {tab === 'competitors' ? (
        <BrandCompetitorsTab />
      ) : tab === 'compare' ? (
        <CompareTab />
      ) : tab === 'gaps & angles' ? (
        <GapsAnglesTab />
      ) : tab === 'websites' ? (
        <WebsitesTab />
      ) : (
        <div className="card card-pad stack gap-8">
          <span className="h2" style={{ textTransform: 'capitalize' }}>{tab}</span>
          <span className="meta">Coming next — this tab isn't wired up yet.</span>
        </div>
      )}
    </div>
  );
}
