import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';

type DomainRow = {
  id: string;
  domain: string;
  health: 'Healthy' | 'Warnings' | 'Stale' | 'Error';
  sitemap_status: 'Discovered' | 'Partial' | 'Failed';
  pages_discovered: number;
  pages_indexed: number;
  last_crawled_at: string | null;
};

type PageRow = {
  id: string;
  url: string;
  title: string | null;
  word_count: number | null;
  status: 'analyzed' | 'pending' | 'failed';
  scraped_at: string;
};

const HEALTH_PILL: Record<DomainRow['health'], string> = {
  Healthy: 'green',
  Warnings: 'amber',
  Stale: 'amber',
  Error: 'red',
};

export function ScrapedPagesTab({ clientId }: { clientId: string }) {
  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setDomains([]);
      setPages([]);
      return;
    }
    const [cRes, dRes, pRes] = await Promise.all([
      supabase.from('clients').select('website').eq('id', clientId).maybeSingle(),
      supabase
        .from('scraped_domains')
        .select(
          'id, domain, health, sitemap_status, pages_discovered, pages_indexed, last_crawled_at',
        )
        .eq('client_id', clientId)
        .order('last_crawled_at', { ascending: false }),
      supabase
        .from('scraped_pages')
        .select('id, url, title, word_count, status, scraped_at')
        .eq('client_id', clientId)
        .order('scraped_at', { ascending: false }),
    ]);
    setWebsite((cRes.data?.website as string | null) ?? null);
    setDomains((dRes.data ?? []) as DomainRow[]);
    setPages((pRes.data ?? []) as PageRow[]);
  }, [clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function onScrape(url: string) {
    if (!supabase || !url) return;
    setScraping(true);
    setMsg(null);
    const { data, error } = await supabase.functions.invoke('scrape-client', {
      body: { client_id: clientId, url },
    });
    setScraping(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    if (!data?.ok) {
      setMsg({ kind: 'err', text: data?.error ?? 'Scrape returned no pages' });
      return;
    }
    setMsg({
      kind: 'ok',
      text: `Scraped ${data.pages_scraped} of ${data.pages_discovered} discovered pages.`,
    });
    refresh();
  }

  if (domains === null || pages === null) {
    return <div className="meta">Loading…</div>;
  }

  if (domains.length === 0) {
    return (
      <div
        className="card card-pad-lg stack gap-12"
        style={{
          alignItems: 'center',
          textAlign: 'center',
          padding: '40px 20px',
          borderStyle: 'dashed',
        }}
      >
        <div className="ph" style={{ width: 72, height: 72, borderRadius: 16 }}>
          <Icon name="link" size={32} />
        </div>
        <div className="h2">No pages scraped yet</div>
        <div className="meta" style={{ maxWidth: 420 }}>
          {website
            ? `Saved website: ${website}. Run the scraper to discover the sitemap, fetch the main pages, and extract content for brand intelligence + Ad Studio briefs.`
            : 'Add a website URL on the client (edit the client) and then run the scraper here.'}
        </div>
        {website && (
          <button
            className="btn primary"
            disabled={scraping}
            onClick={() => onScrape(website)}
          >
            {scraping ? 'Scraping…' : 'Scrape now'}
          </button>
        )}
        {msg && (
          <div
            className="meta"
            style={{
              color: msg.kind === 'err' ? 'var(--danger, #c33)' : 'var(--accent)',
              fontSize: 12,
            }}
          >
            {msg.kind === 'err' ? '⚠ ' : '✓ '}
            {msg.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack gap-12">
      <div className="row between">
        <div className="row gap-8">
          {domains.map((d) => (
            <span key={d.id} className="pill">
              {d.domain}
            </span>
          ))}
        </div>
        <div className="row gap-8">
          {website && (
            <button
              className="btn ghost"
              disabled={scraping}
              onClick={() => onScrape(website)}
            >
              <Icon name="refresh" size={13} /> {scraping ? 'Re-scraping…' : 'Re-scrape'}
            </button>
          )}
        </div>
      </div>
      {msg && (
        <div
          className="meta"
          style={{
            color: msg.kind === 'err' ? 'var(--danger, #c33)' : 'var(--accent)',
            fontSize: 12,
          }}
        >
          {msg.kind === 'err' ? '⚠ ' : '✓ '}
          {msg.text}
        </div>
      )}

      {domains.map((d) => {
        const rows = pages.filter((p) => safeHost(p.url) === d.domain);
        const lastCrawled = d.last_crawled_at
          ? new Date(d.last_crawled_at).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : '—';
        return (
          <div key={d.id} className="card">
            <div
              className="card-pad row between"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="row gap-8">
                <span style={{ fontWeight: 500 }}>{d.domain}</span>
                <span className={`pill ${HEALTH_PILL[d.health]}`}>
                  <span className="dot" />
                  {d.health}
                </span>
                <span className="meta">
                  {d.pages_indexed} indexed · {d.pages_discovered} discovered · sitemap{' '}
                  {d.sitemap_status.toLowerCase()} · last scraped {lastCrawled}
                </span>
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Title</th>
                  <th style={{ textAlign: 'right' }}>Words</th>
                  <th>Last scraped</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 16, color: 'var(--fg-3)' }}>
                      No pages indexed for this domain yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {safePath(r.url)}
                      </td>
                      <td>{r.title ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.word_count?.toLocaleString() ?? '—'}
                      </td>
                      <td className="meta">
                        {new Date(r.scraped_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn ghost sm"
                          style={{ display: 'inline-block' }}
                        >
                          View ↗
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return '';
  }
}
function safePath(u: string): string {
  try {
    const x = new URL(u);
    return x.pathname + (x.search || '');
  } catch {
    return u;
  }
}
