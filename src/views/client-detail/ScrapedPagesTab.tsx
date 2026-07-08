import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../auth/supabaseClient';
import { Icon } from '../../components/Icon';
import { enqueueJob } from '../../data/useJob';
import { useWorkspace } from '../../workspace/WorkspaceProvider';

type DomainRow = {
  id: string;
  domain: string;
  health: 'Healthy' | 'Warnings' | 'Stale' | 'Error';
  sitemap_status: 'Discovered' | 'Partial' | 'Failed';
  pages_discovered: number;
  pages_indexed: number;
  last_crawled_at: string | null;
};

/** Page exclusion state. Mirrors scraped_pages.excluded:
 *  none   — active (re-scraped + fed to the AI)
 *  scrape — skip re-scraping, keep last content for the AI
 *  all    — skip re-scraping AND withhold content from the AI */
type Excluded = 'none' | 'scrape' | 'all';

type PageRow = {
  id: string;
  url: string;
  title: string | null;
  word_count: number | null;
  status: 'analyzed' | 'pending' | 'failed';
  scraped_at: string;
  excluded: Excluded;
  content_edited: boolean;
};

const HEALTH_PILL: Record<DomainRow['health'], string> = {
  Healthy: 'green',
  Warnings: 'amber',
  Stale: 'amber',
  Error: 'red',
};

const EXCLUDE_LABEL: Record<Excluded, string> = {
  none: 'Active',
  scrape: 'Skip re-scrape',
  all: 'Skip re-scrape + content',
};

export function ScrapedPagesTab({ clientId }: { clientId: string }) {
  const workspace = useWorkspace();
  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addUrls, setAddUrls] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editor, setEditor] = useState<PageRow | null>(null);
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
        .is('competitor_id', null)
        .order('last_crawled_at', { ascending: false }),
      supabase
        .from('scraped_pages')
        .select('id, url, title, word_count, status, scraped_at, excluded, content_edited')
        .eq('client_id', clientId)
        .is('competitor_id', null)
        .order('scraped_at', { ascending: false }),
    ]);
    setWebsite((cRes.data?.website as string | null) ?? null);
    setDomains((dRes.data ?? []) as DomainRow[]);
    setPages((pRes.data ?? []) as PageRow[]);
  }, [clientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-run the brand profile from the freshly scraped content (best-effort;
  // fields the user has edited are never overwritten).
  const reanalyze = useCallback(
    (url: string) => {
      if (!workspace) return;
      enqueueJob({
        type: 'website_analysis',
        workspaceId: workspace.id,
        clientId,
        input: { url },
      }).catch((e) => console.warn('Brand analysis enqueue failed:', e));
    },
    [workspace, clientId],
  );

  // Scan the freshly recorded nav links / discovered URLs for per-location
  // pages (best-effort — new finds appear in the Locations tab). Discovery
  // scrapes only: add-mode doesn't refresh the detection material.
  const detectLocations = useCallback(() => {
    if (!workspace) return;
    enqueueJob({
      type: 'location_detection',
      workspaceId: workspace.id,
      clientId,
      input: {},
    }).catch((e) => console.warn('Location detection enqueue failed:', e));
  }, [workspace, clientId]);

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
      text: `Scraped ${data.pages_scraped} of ${data.pages_discovered} discovered pages. Updating the brand profile…`,
    });
    reanalyze(url);
    detectLocations();
    refresh();
  }

  // Add-mode: scrape only the URLs the user pasted, leaving existing pages
  // untouched. Accepts newline / comma / space separated URLs or paths.
  async function onAddPages() {
    if (!supabase) return;
    const seed = website ?? domains?.[0]?.domain ?? '';
    const base = seed ? (seed.startsWith('http') ? seed : `https://${seed}`) : '';
    const urls = addUrls
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        if (/^https?:\/\//i.test(s)) return s;
        if (base) {
          try {
            return new URL(s.startsWith('/') ? s : `/${s}`, base).toString();
          } catch {
            return s;
          }
        }
        return `https://${s}`;
      });
    if (urls.length === 0) {
      setMsg({ kind: 'err', text: 'Enter one or more page URLs to add.' });
      return;
    }
    setAdding(true);
    setMsg(null);
    const { data, error } = await supabase.functions.invoke('scrape-client', {
      body: { client_id: clientId, url: base || urls[0], urls },
    });
    setAdding(false);
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    if (!data?.ok) {
      setMsg({ kind: 'err', text: data?.error ?? 'None of those pages could be scraped' });
      return;
    }
    setMsg({
      kind: 'ok',
      text: `Added ${data.pages_scraped} page${data.pages_scraped === 1 ? '' : 's'}. Updating the brand profile…`,
    });
    setAddUrls('');
    setShowAdd(false);
    reanalyze(base || urls[0]);
    refresh();
  }

  async function setExclusion(page: PageRow, mode: Excluded) {
    if (!supabase) return;
    // Optimistic — the RPC only touches this row's `excluded`.
    setPages((prev) =>
      (prev ?? []).map((p) => (p.id === page.id ? { ...p, excluded: mode } : p)),
    );
    const { error } = await supabase.rpc('set_scraped_page_exclusion', {
      p_page_id: page.id,
      p_mode: mode,
    });
    if (error) {
      setMsg({ kind: 'err', text: error.message });
      refresh();
    }
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
        {msg && <Banner msg={msg} />}
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
          <button
            className="btn ghost"
            disabled={scraping || adding}
            onClick={() => setShowAdd((s) => !s)}
          >
            <Icon name="plus" size={13} /> Add pages
          </button>
          {website && (
            <button
              className="btn ghost"
              disabled={scraping || adding}
              onClick={() => onScrape(website)}
            >
              <Icon name="refresh" size={13} /> {scraping ? 'Re-scraping…' : 'Re-scrape'}
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="card card-pad stack gap-8">
          <div style={{ fontWeight: 500 }}>Add individual pages</div>
          <div className="meta">
            Paste one or more page URLs (or paths like <code>/pricing</code>), separated by
            new lines, commas, or spaces. Only these pages are scraped — your existing pages
            are left untouched.
          </div>
          <textarea
            className="input"
            rows={3}
            placeholder={'/pricing\n/faq\nhttps://example.com/team'}
            value={addUrls}
            onChange={(e) => setAddUrls(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'var(--mono, monospace)', fontSize: 12 }}
          />
          <div className="row gap-8">
            <button className="btn primary" disabled={adding} onClick={onAddPages}>
              {adding ? 'Adding…' : 'Add pages'}
            </button>
            <button className="btn ghost" disabled={adding} onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && <Banner msg={msg} />}

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
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, color: 'var(--fg-3)' }}>
                      No pages indexed for this domain yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} style={{ opacity: r.excluded === 'all' ? 0.5 : 1 }}>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {safePath(r.url)}
                      </td>
                      <td>{r.title ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <button
                          className="btn ghost sm"
                          title="View / edit the extracted text for this page"
                          onClick={() => setEditor(r)}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {r.word_count?.toLocaleString() ?? '—'}
                          {r.content_edited && (
                            <span
                              title="Hand-edited — preserved on re-scrape"
                              style={{ marginLeft: 4, color: 'var(--accent)' }}
                            >
                              ✎
                            </span>
                          )}
                        </button>
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
                        <select
                          className="input"
                          value={r.excluded}
                          title="Include this page in re-scrapes and AI analysis, or exclude it"
                          onChange={(e) => setExclusion(r, e.target.value as Excluded)}
                          style={{ fontSize: 12, padding: '2px 4px' }}
                        >
                          {(Object.keys(EXCLUDE_LABEL) as Excluded[]).map((k) => (
                            <option key={k} value={k}>
                              {EXCLUDE_LABEL[k]}
                            </option>
                          ))}
                        </select>
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

      {editor && (
        <ContentEditor
          page={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Banner({ msg }: { msg: { kind: 'ok' | 'err'; text: string } }) {
  return (
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
  );
}

/** Modal editor over a page's extracted text. Loads the current content on
 * open and saves via the membership-checked set_scraped_page_content RPC,
 * which recomputes word_count and flags the row so re-scrapes preserve it. */
function ContentEditor({
  page,
  onClose,
  onSaved,
}: {
  page: PageRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) {
        setText('');
        return;
      }
      const { data, error } = await supabase
        .from('scraped_pages')
        .select('content')
        .eq('id', page.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) setErr(error.message);
      setText((data?.content as string | null) ?? '');
    })();
    return () => {
      cancelled = true;
    };
  }, [page.id]);

  async function save() {
    if (!supabase || text === null) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase.rpc('set_scraped_page_content', {
      p_page_id: page.id,
      p_content: text,
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved();
  }

  const wordCount = (text ?? '').trim() ? (text ?? '').trim().split(/\s+/).length : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 24,
      }}
    >
      <div
        className="card card-pad stack gap-12"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(760px, 100%)', maxHeight: '85vh' }}
      >
        <div className="row between">
          <div className="stack" style={{ gap: 2 }}>
            <div style={{ fontWeight: 600 }}>{page.title ?? safePath(page.url)}</div>
            <div className="meta mono" style={{ fontSize: 12 }}>
              {safePath(page.url)}
            </div>
          </div>
          <button className="btn ghost sm" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="meta">
          Extracted text used to brief the AI. Edit to correct or add wording for this page —
          your edit is preserved on future re-scrapes.
        </div>
        {text === null ? (
          <div className="meta">Loading content…</div>
        ) : (
          <textarea
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              width: '100%',
              minHeight: 320,
              maxHeight: '55vh',
              resize: 'vertical',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          />
        )}
        {err && <Banner msg={{ kind: 'err', text: err }} />}
        <div className="row between">
          <span className="meta">{wordCount.toLocaleString()} words</span>
          <div className="row gap-8">
            <button className="btn ghost" disabled={saving} onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={saving || text === null}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
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
