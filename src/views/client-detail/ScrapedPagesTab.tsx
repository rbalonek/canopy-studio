import { useMemo } from 'react';
import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type {
  DomainHealth,
  ScrapeAnalysisStatus,
  ScrapedDomain,
  ScrapedPage,
} from '../../data/types';

const HEALTH_PILL: Record<DomainHealth, string> = {
  Healthy: 'green',
  Warnings: 'amber',
  Stale: 'amber',
  Error: 'red',
};

const ANALYSIS_PILL: Record<ScrapeAnalysisStatus, string> = {
  Done: 'green',
  Stale: 'amber',
  Failed: 'red',
  Pending: 'indigo',
};

export function ScrapedPagesTab({ clientId }: { clientId: string }) {
  const { data: domains, loading: domainsLoading } = useQuery<ScrapedDomain[]>(
    (p) => p.listDomainsForClient(clientId),
    [clientId],
  );
  const { data: pages, loading: pagesLoading } = useQuery<ScrapedPage[]>(
    (p) => p.listScrapedPagesForClient(clientId),
    [clientId],
  );

  const pagesByDomain = useMemo(() => {
    const map: Record<string, ScrapedPage[]> = {};
    (pages ?? []).forEach((p) => {
      (map[p.domainId] ||= []).push(p);
    });
    return map;
  }, [pages]);

  if (domainsLoading || pagesLoading) {
    return <div className="meta">Loading…</div>;
  }

  if (!domains || domains.length === 0) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{ alignItems: 'center', textAlign: 'center', padding: '40px 20px', borderStyle: 'dashed' }}
      >
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="link" size={32} />
        </div>
        <div className="h2">No domains connected yet</div>
        <div className="meta" style={{ maxWidth: 360 }}>
          Add a website URL and we'll discover the sitemap, scrape each page, and extract brand positioning + messaging pillars.
        </div>
        <button className="btn primary">
          <Icon name="plus" size={13} /> Add domain
        </button>
      </div>
    );
  }

  return (
    <div className="stack gap-12">
      <div className="row between">
        <div className="row gap-8">
          <div className="input" style={{ width: 260 }}>
            <Icon name="search" size={13} />
            <span style={{ color: 'var(--fg-2)' }}>Filter pages…</span>
          </div>
          {domains.map((d) => (
            <span key={d.id} className="pill">
              {d.domain}
            </span>
          ))}
        </div>
        <div className="row gap-8">
          <button className="btn ghost">
            <Icon name="refresh" size={13} /> Re-scrape all
          </button>
          <button className="btn primary">
            <Icon name="plus" size={13} /> Add domain
          </button>
        </div>
      </div>

      {domains.map((d) => {
        const rows = pagesByDomain[d.id] ?? [];
        return (
          <div key={d.id} className="card">
            <div className="card-pad row between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="row gap-8">
                <span style={{ fontWeight: 500 }}>{d.domain}</span>
                <span className={`pill ${HEALTH_PILL[d.health]}`}>
                  <span className="dot" />
                  {d.health}
                </span>
                <span className="meta">
                  {d.pageCount} pages · last scraped {d.lastScrapedLabel}
                </span>
              </div>
              <div className="row gap-8">
                <button className="btn sm">Select pages</button>
                <button className="btn sm">
                  <Icon name="refresh" size={12} /> Re-scrape
                </button>
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>
                    <input type="checkbox" />
                  </th>
                  <th>Path</th>
                  <th>Title</th>
                  <th>Words</th>
                  <th>Last scraped</th>
                  <th>AI analysis</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <input type="checkbox" defaultChecked={i < 3} />
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {r.path}
                    </td>
                    <td>{r.title}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.words}</td>
                    <td className="meta">{r.lastScrapedLabel}</td>
                    <td>
                      <span
                        className={`pill ${ANALYSIS_PILL[r.analysisStatus]}`}
                        style={{ padding: '0 6px', fontSize: 10 }}
                      >
                        <span className="dot" />
                        {r.analysisStatus}
                      </span>
                    </td>
                    <td>
                      <button className="btn ghost sm">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
