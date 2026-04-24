import { useMemo, useState } from 'react';
import { AIBadge } from '../components/AIBadge';
import { Status } from '../components/Status';
import { useQuery } from '../data/context';
import type { ApprovalItem, ApprovalKind } from '../data/types';

type TabKey = 'all' | 'posts' | 'ads' | 'comments';

const TAB_KIND: Record<Exclude<TabKey, 'all'>, ApprovalKind> = {
  posts: 'post',
  ads: 'ad',
  comments: 'comment',
};

export function Approvals() {
  const { data: approvals, loading } = useQuery<ApprovalItem[]>((p) => p.listApprovals());
  const [tab, setTab] = useState<TabKey>('all');

  const counts = useMemo(() => {
    const a = approvals ?? [];
    return {
      all: a.length,
      posts: a.filter((r) => r.kind === 'post').length,
      ads: a.filter((r) => r.kind === 'ad').length,
      comments: a.filter((r) => r.kind === 'comment').length,
    };
  }, [approvals]);

  const tabs: { k: TabKey; n: string }[] = [
    { k: 'all', n: `All · ${counts.all}` },
    { k: 'posts', n: `Posts · ${counts.posts}` },
    { k: 'ads', n: `Ads · ${counts.ads}` },
    { k: 'comments', n: `Comments · ${counts.comments}` },
  ];

  const filtered = (approvals ?? []).filter((r) => tab === 'all' || r.kind === TAB_KIND[tab]);
  const aiCount = (approvals ?? []).filter((r) => r.aiDrafted).length;
  const userCount = (approvals ?? []).length - aiCount;

  if (loading) {
    return (
      <div className="content wide">
        <span className="meta">Loading…</span>
      </div>
    );
  }

  return (
    <div className="content wide">
      <div className="row between" style={{ marginBottom: 16 }}>
        <div className="stack gap-4">
          <h1 className="h0">Approvals</h1>
          <span className="meta">
            {counts.all} pending · {aiCount} AI-drafted, {userCount} user-drafted
          </span>
        </div>
        <div className="row gap-8">
          <button className="btn">Approve selected</button>
          <button className="btn ghost">Reject selected</button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {tabs.map((t) => (
          <div key={t.k} className={`tab ${tab === t.k ? 'on' : ''}`} onClick={() => setTab(t.k)}>
            {t.n}
          </div>
        ))}
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 30 }}>
                <input type="checkbox" />
              </th>
              <th style={{ width: 64 }}>Thumb</th>
              <th>Channel</th>
              <th>Client</th>
              <th>Created by</th>
              <th>Created</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <input type="checkbox" />
                </td>
                <td>
                  <div className="ph" style={{ width: 40, height: 40 }} />
                </td>
                <td>{r.channel}</td>
                <td>{r.clientName}</td>
                <td>
                  {r.aiDrafted ? (
                    <span className="row gap-4">
                      <AIBadge />
                    </span>
                  ) : (
                    r.createdBy
                  )}
                </td>
                <td className="meta">{r.createdLabel}</td>
                <td className="meta">{r.scheduledLabel}</td>
                <td>
                  <Status s={r.status} />
                </td>
                <td>
                  <div className="row gap-4">
                    <button className="btn primary sm">Approve</button>
                    <button className="btn ghost sm">Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
