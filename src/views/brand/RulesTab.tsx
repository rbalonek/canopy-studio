import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type { BrandRule, BrandRuleCategory } from '../../data/types';

const BUCKETS: {
  category: BrandRuleCategory;
  title: string;
  pill: 'teal' | 'red' | 'indigo' | 'gray';
}[] = [
  { category: 'dos',    title: "Do's — across all clients",    pill: 'teal' },
  { category: 'donts',  title: "Don'ts — across all clients",  pill: 'red' },
  { category: 'tone',   title: 'Tone',                          pill: 'indigo' },
  { category: 'visual', title: 'Visual',                        pill: 'gray' },
];

export function RulesTab() {
  const { data: rules, loading } = useQuery<BrandRule[]>((p) => p.listBrandRules());

  if (loading) return <div className="meta">Loading…</div>;

  return (
    <div className="grid grid-2 gap-16" style={{ gap: 16 }}>
      {BUCKETS.map((b) => {
        const items = (rules ?? []).filter((r) => r.category === b.category);
        return (
          <div key={b.category} className="card card-pad stack gap-10">
            <div className="row between">
              <span className="h2">{b.title}</span>
              <button className="btn ghost sm">
                <Icon name="plus" size={12} /> Add
              </button>
            </div>
            <div className="stack gap-6">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="row between"
                  style={{
                    padding: '6px 8px',
                    background: 'var(--bg-2)',
                    borderRadius: 4,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="row gap-8">
                    <span className={`pill ${b.pill}`}>
                      <span className="dot" />
                    </span>
                    <span style={{ fontSize: 13 }}>{r.text}</span>
                  </div>
                  <Icon name="dots" size={12} />
                </div>
              ))}
            </div>
            <div className="meta">
              Used by Claude to validate generated content before it hits the approval queue.
            </div>
          </div>
        );
      })}
    </div>
  );
}
