import { Icon } from '../components/Icon';
import { Status } from '../components/Status';
import { useQuery } from '../data/context';
import type { PostStatus, WeekPostsDay } from '../data/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const POST_DATES = [3, 5, 8, 10, 12, 15, 17, 19, 21, 23, 26, 28];

const STATUS_BORDER: Record<PostStatus, string> = {
  Published: 'var(--green)',
  Scheduled: 'var(--ai)',
  Approved: 'var(--accent)',
  Error: 'var(--red)',
  Draft: 'var(--border)',
};

function fmtIcon(fmt: 'Post' | 'Reel' | 'Carousel'): string {
  if (fmt === 'Reel') return 'bolt';
  if (fmt === 'Carousel') return 'grid';
  return 'image';
}

export function Calendar() {
  const { data: week } = useQuery<WeekPostsDay[]>((p) => p.listPostsWeek());

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4">
          <h1 className="h0">Content Calendar</h1>
          <span className="meta">April 2025 · 28 scheduled, 11 pending approval</span>
        </div>
        <div className="row gap-8">
          <div className="seg">
            <button className="on">Month</button>
            <button>Week</button>
            <button>List</button>
          </div>
          <button className="btn ghost">
            <Icon name="upload" size={13} /> Bulk import
          </button>
          <button className="btn ai">
            <Icon name="sparkles" size={13} /> AI generate week
          </button>
          <button className="btn primary">Schedule all approved</button>
        </div>
      </div>

      <div className="card">
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--border)', gap: 1 }}
        >
          {DAYS.map((d) => (
            <div
              key={d}
              style={{
                padding: '8px 12px',
                background: 'var(--bg-1)',
                fontSize: 12,
                color: 'var(--fg-2)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {d}
            </div>
          ))}
          {Array.from({ length: 35 }, (_, i) => {
            const date = i - 2;
            const inMonth = date > 0 && date <= 30;
            const dayData = week?.[i % 7];
            const showPosts = inMonth && POST_DATES.includes(date);
            return (
              <div
                key={i}
                style={{
                  background: 'var(--bg-1)',
                  minHeight: 100,
                  padding: 8,
                  opacity: inMonth ? 1 : 0.35,
                }}
              >
                <div className="meta" style={{ fontSize: 11, marginBottom: 6 }}>
                  {inMonth ? date : ''}
                </div>
                {showPosts && dayData && (
                  <div className="stack gap-4">
                    {dayData.list.slice(0, 2).map((p, j) => (
                      <div
                        key={j}
                        className="row gap-4"
                        style={{
                          padding: '3px 6px',
                          background: 'var(--bg-2)',
                          borderRadius: 4,
                          border: `1px solid ${STATUS_BORDER[p.status]}`,
                          fontSize: 11,
                        }}
                      >
                        <Icon name={fmtIcon(p.fmt)} size={10} />
                        <span
                          style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.client}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="row gap-16" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <span className="meta">Legend:</span>
        <Status s="Draft" />
        <Status s="Approved" />
        <Status s="Scheduled" />
        <Status s="Published" />
        <Status s="Error" />
      </div>
    </div>
  );
}
