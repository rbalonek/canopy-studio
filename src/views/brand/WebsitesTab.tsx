import { Icon } from '../../components/Icon';
import { useQuery } from '../../data/context';
import type { Client, DomainHealth, ScrapedDomain } from '../../data/types';

const HEALTH_PILL: Record<DomainHealth, string> = {
  Healthy: 'green',
  Warnings: 'amber',
  Stale: 'amber',
  Error: 'red',
};

export function WebsitesTab() {
  const { data: domains, loading: domainsLoading } = useQuery<ScrapedDomain[]>((p) => p.listDomains());
  const { data: clients, loading: clientsLoading } = useQuery<Client[]>((p) => p.listClients());

  if (domainsLoading || clientsLoading) return <div className="meta">Loading…</div>;

  const clientName = (id: string) => clients?.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="stack gap-12">
      <div className="row between">
        <div className="input" style={{ width: 260 }}>
          <Icon name="search" size={13} />
          <span style={{ color: 'var(--fg-2)' }}>Filter domains…</span>
        </div>
        <button className="btn primary">
          <Icon name="plus" size={13} /> Add domain
        </button>
      </div>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Client</th>
              <th>Pages</th>
              <th>Sitemap</th>
              <th>Last scraped</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(domains ?? []).map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 500 }}>{d.domain}</td>
                <td>{clientName(d.clientId)}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{d.pageCount}</td>
                <td className="meta">{d.sitemapStatus}</td>
                <td className="meta">{d.lastScrapedLabel}</td>
                <td>
                  <span className={`pill ${HEALTH_PILL[d.health]}`}>
                    <span className="dot" />
                    {d.health}
                  </span>
                </td>
                <td>
                  <div className="row gap-4">
                    <button className="btn ghost sm">View pages</button>
                    <button className="btn ghost sm">
                      <Icon name="refresh" size={12} />
                    </button>
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
