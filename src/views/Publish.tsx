import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { useQuery } from '../data/context';
import type { QueuedPost } from '../data/types';

const COLUMNS: { key: QueuedPost['status']; label: string }[] = [
  { key: 'Queued',     label: 'Queued' },
  { key: 'Publishing', label: 'Publishing' },
  { key: 'Published',  label: 'Published' },
  { key: 'Failed',     label: 'Failed' },
];

function fmtIcon(fmt: QueuedPost['fmt']): string {
  if (fmt === 'Reel') return 'bolt';
  if (fmt === 'Carousel') return 'grid';
  return 'image';
}

export function Publish() {
  const { data: queue } = useQuery<QueuedPost[]>((p) => p.listPostsQueue());

  const byStatus = useMemo(() => {
    const map: Record<QueuedPost['status'], QueuedPost[]> = {
      Queued: [],
      Publishing: [],
      Published: [],
      Failed: [],
    };
    (queue ?? []).forEach((p) => map[p.status].push(p));
    return map;
  }, [queue]);

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="stack gap-4">
          <h1 className="h0">Publishing Queue</h1>
          <span className="meta">Channel routing · FB Pages, Instagram Business</span>
        </div>
        <div className="row gap-8">
          <div
            className="row gap-6 meta"
            style={{
              padding: '4px 10px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
            }}
          >
            🔒 Auto-publish is off — everything requires approval
          </div>
          <button className="btn ghost">
            <Icon name="upload" size={13} /> Bulk CSV upload
          </button>
        </div>
      </div>

      <div className="banner" style={{ marginBottom: 16 }}>
        <Icon name="check" size={14} />
        <span>
          3 posts will go to Facebook Pages · 3 to Instagram · 1 skipped (no IG connection for Kettle &amp; Crumb)
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn sm">Review routing</button>
        <button className="btn primary sm">Confirm schedule</button>
      </div>

      <div className="grid grid-4 gap-16" style={{ gap: 16, alignItems: 'flex-start' }}>
        {COLUMNS.map((col) => {
          const items = byStatus[col.key];
          return (
            <div key={col.key} className="stack gap-8">
              <div className="row between" style={{ padding: '0 4px' }}>
                <span style={{ fontWeight: 500 }}>{col.label}</span>
                <span className="pill">{items.length}</span>
              </div>
              {items.map((p) => (
                <div
                  key={`${p.thumb}-${p.client}`}
                  className={`card card-pad stack gap-6 ${p.status === 'Failed' ? 'bdr-red' : ''}`}
                >
                  <div className="ph" style={{ height: 80 }}>
                    Creative {p.thumb}
                  </div>
                  <div className="row between">
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{p.client}</span>
                    <Icon name={fmtIcon(p.fmt)} size={12} />
                  </div>
                  <div className="row between meta" style={{ fontSize: 11 }}>
                    <span>{p.when}</span>
                    <div className="row gap-4">
                      {p.chan.map((c) => (
                        <span key={c} className="tag" style={{ fontSize: 10 }}>
                          {c.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                  {p.status === 'Failed' && <button className="btn danger sm">Retry →</button>}
                </div>
              ))}
              {items.length === 0 && (
                <div className="ph" style={{ height: 60 }}>
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
