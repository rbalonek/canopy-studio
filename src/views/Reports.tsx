import { Bars } from '../components/Bars';
import { Icon } from '../components/Icon';

const SAVED_REPORTS: { title: string; cadence: string; icon: string }[] = [
  { title: 'Weekly spend by client',        cadence: 'Monday 8:00 AM · jordan@redwood.co', icon: 'chart' },
  { title: 'Lead Gen performance MTD',      cadence: 'Ad-hoc · CSV export',                 icon: 'bolt' },
  { title: 'Content posting cadence',       cadence: 'First of month · CSV',                icon: 'calendar' },
  { title: 'Competitor share of voice',     cadence: 'Weekly · PDF',                        icon: 'brain' },
];

const VIZ_OPTIONS = ['Line', 'Bar', 'Table', 'Funnel'] as const;
const SCHEDULE_OPTIONS = ['None', 'Daily', 'Weekly'] as const;

export function Reports() {
  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4">
          <h1 className="h0">Reports</h1>
          <span className="meta">Saved views · schedule + export</span>
        </div>
        <button className="btn primary">
          <Icon name="plus" size={13} /> New report
        </button>
      </div>

      <div className="grid grid-3 gap-16" style={{ gap: 16, marginBottom: 20 }}>
        {SAVED_REPORTS.map((r) => (
          <div key={r.title} className="card card-pad stack gap-8">
            <div className="row between">
              <span style={{ fontWeight: 500 }}>{r.title}</span>
              <Icon name={r.icon} size={14} />
            </div>
            <div className="meta">{r.cadence}</div>
            <div className="ph" style={{ height: 80, marginTop: 4 }}>
              Thumbnail preview
            </div>
            <div className="row gap-6">
              <button className="btn sm">Open</button>
              <button className="btn ghost sm">Run now</button>
              <button className="btn ghost sm">Edit</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="h2">Report builder</span>
          <span className="meta">Lo-fi preview</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: '260px 1fr', gap: 1, background: 'var(--border)' }}>
          <div className="stack" style={{ background: 'var(--bg-1)', padding: 16, gap: 12 }}>
            <div className="stack gap-4">
              <span className="meta">Metric</span>
              <div className="input">
                <span>Spend</span>
                <Icon name="chevd" size={12} />
              </div>
            </div>
            <div className="stack gap-4">
              <span className="meta">Dimension</span>
              <div className="input">
                <span>Client</span>
                <Icon name="chevd" size={12} />
              </div>
            </div>
            <div className="stack gap-4">
              <span className="meta">Filters</span>
              <div className="stack gap-4">
                <span className="pill">Strategy = Lead Gen</span>
                <span className="pill">Spend &gt; $500</span>
              </div>
            </div>
            <div className="stack gap-4">
              <span className="meta">Viz</span>
              <div className="seg">
                {VIZ_OPTIONS.map((v) => (
                  <button key={v} className={v === 'Bar' ? 'on' : ''}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="stack gap-4">
              <span className="meta">Schedule</span>
              <div className="seg">
                {SCHEDULE_OPTIONS.map((s) => (
                  <button key={s} className={s === 'None' ? 'on' : ''}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn primary">Save report</button>
          </div>
          <div style={{ background: 'var(--bg-1)', padding: 20 }}>
            <Bars h={260} />
          </div>
        </div>
      </div>
    </div>
  );
}
