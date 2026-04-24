import { AIBadge } from '../components/AIBadge';
import { Delta } from '../components/Delta';
import { Empty } from '../components/Empty';
import { EntityCard } from '../components/EntityCard';
import { Icon } from '../components/Icon';
import { KPI } from '../components/KPI';
import { ProgressBanner } from '../components/ProgressBanner';
import { Status } from '../components/Status';
import { Strategy } from '../components/Strategy';

const STRATEGIES = ['Lead Gen', 'ATC', 'VC', 'Traffic', 'Video', 'Purchase'] as const;
const STATUSES = ['Draft', 'Approved', 'Scheduled', 'Published', 'Error', 'Paused'] as const;
const PALETTE_COMMANDS = [
  '→ Open Acme Dental',
  '→ Create post for Seaside Yoga',
  '→ Refresh META data',
  '→ Schedule all approved',
  '→ Generate ad ideas',
];

export function Components() {
  return (
    <div className="content wide">
      <div className="stack gap-8" style={{ marginBottom: 20 }}>
        <span className="anno">WIREFRAME · Component Library</span>
        <h1 className="h0">Shared components</h1>
        <div className="meta" style={{ maxWidth: 640 }}>
          Every shared piece used across the 14 screens. Structured lo-fi: monochrome zinc shell,
          single teal accent for primary actions and performance, indigo reserved exclusively for
          AI-generated surfaces.
        </div>
      </div>

      <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
        {/* KPI */}
        <div className="card card-pad-lg stack gap-12">
          <div className="h2">KPI Tiles</div>
          <div className="grid grid-2 gap-16" style={{ gap: 12 }}>
            <KPI label="Total Spend" value="$94,842" delta={12.4} seed={3} />
            <KPI label="Conversions" value="1,482" delta={-6.1} seed={5} />
          </div>
          <div className="meta">Two sizes. Label + big number + delta vs prior + sparkline.</div>
        </div>

        {/* Pills & Badges */}
        <div className="card card-pad-lg stack gap-12">
          <div className="h2">Pills &amp; Badges</div>
          <div className="stack gap-8">
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <Delta v={12.4} />
              <Delta v={-6.1} />
              <Delta neutral />
            </div>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              {STRATEGIES.map((s) => (
                <Strategy key={s} s={s} />
              ))}
            </div>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              {STATUSES.map((s) => (
                <Status key={s} s={s} />
              ))}
            </div>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              <AIBadge />
              <span className="tag">tag</span>
              <span className="kbd">⌘K</span>
            </div>
          </div>
        </div>

        {/* Entity card */}
        <div className="card card-pad-lg stack gap-12">
          <div className="h2">Client / Location Card</div>
          <EntityCard
            name="Acme Dental"
            industry="Dental / Healthcare"
            mtd="$18,420"
            campaigns={6}
            posts={4}
            complete={86}
          />
          <div className="meta">Brand-completeness ring (0–100%), three inline stats.</div>
        </div>

        {/* AI Surface */}
        <div className="card card-pad-lg stack gap-12">
          <div className="h2">AI Surface</div>
          <div className="ai-surface card-pad stack gap-8">
            <div className="row between">
              <span style={{ fontWeight: 500 }}>Claude's take</span>
              <AIBadge />
            </div>
            <div style={{ fontSize: 13 }}>
              Lead Gen campaigns for Acme Dental are overpacing by 31% this week. Two ad sets
              drove 68% of spend but 12% of conversions.
            </div>
            <div className="row gap-8">
              <button className="btn ai sm">Take action</button>
              <button className="btn ghost sm">Why?</button>
            </div>
          </div>
          <div className="meta">1px indigo→teal gradient border. Wrap any AI-generated content.</div>
        </div>

        {/* Progress banner */}
        <div className="card card-pad-lg stack gap-12">
          <div className="h2">Progress Banner</div>
          <ProgressBanner
            label="Refreshing META data for 12 ad accounts"
            pct={42}
            eta="~6m remaining"
          />
          <div className="meta">Used for META refresh (~10m), bulk scrape, AI generation.</div>
        </div>

        {/* Empty state */}
        <div className="card card-pad-lg stack gap-12">
          <div className="h2">Empty State</div>
          <Empty
            title="No competitors tracked yet"
            body="Paste a competitor URL and we'll discover their sitemap, extract positioning, and surface messaging gaps."
            cta="+ Add competitor"
            icon="brain"
          />
        </div>

        {/* Right drawer preview (static) */}
        <div className="card card-pad-lg stack gap-12">
          <div className="h2">Right Drawer (480px)</div>
          <div
            style={{
              border: '1px dashed var(--border-2)',
              borderRadius: 6,
              padding: 12,
              background: 'var(--bg-2)',
            }}
          >
            <div className="row between" style={{ marginBottom: 10 }}>
              <span style={{ fontWeight: 500 }}>Add client</span>
              <Icon name="close" size={14} />
            </div>
            <div className="stack gap-8">
              <div className="row gap-8 meta">
                <span>Basics</span>→<span>Brand</span>→<span>META</span>→<span>Website</span>
              </div>
              <div className="ph" style={{ height: 32 }}>
                Client name
              </div>
              <div className="ph" style={{ height: 32 }}>
                Industry
              </div>
              <div className="ph" style={{ height: 32 }}>
                Website URL
              </div>
            </div>
          </div>
          <div className="meta">All create/edit forms use the drawer pattern — never modals.</div>
        </div>

        {/* Command palette */}
        <div className="card card-pad-lg stack gap-12">
          <div className="h2">Command Palette (⌘K)</div>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-2)',
              padding: 8,
            }}
          >
            <div className="input" style={{ margin: 4 }}>
              <Icon name="search" size={13} />
              <span style={{ color: 'var(--fg-2)', fontSize: 13 }}>
                Type a command or search…
              </span>
            </div>
            <div className="stack" style={{ fontSize: 13 }}>
              {PALETTE_COMMANDS.map((t, i) => (
                <div
                  key={t}
                  className="row between"
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    background: i === 0 ? 'var(--bg-3)' : 'transparent',
                  }}
                >
                  <span>{t}</span>
                  <span className="kbd">↵</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
