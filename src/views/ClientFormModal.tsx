import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '../auth/supabaseClient';
import { Icon } from '../components/Icon';
import { enqueueJob } from '../data/useJob';
import type { Industry } from '../data/types';

const INDUSTRIES: Industry[] = [
  'Dental / Healthcare',
  'Fitness / Wellness',
  'Automotive',
  'Retail / E-commerce',
  'Food & Beverage',
  'Professional Services',
  'Optometry',
  'Home Services',
];

/** Create or edit a client. Create offers a "Scrape site" option (default on
 * when a website is given): the modal stays open through the scrape and then
 * chains website_analysis + location_detection, so the Scraped Pages and
 * Brand tabs fill straight from this popup. Closing mid-scrape just detaches
 * the chain — it finishes in the background. Edit updates the row and runs
 * the same chain detached when the website was added or changed — so a client
 * whose original scrape never happened gets one by simply saving its URL
 * here. The chain is best-effort; the Scraped Pages tab has a manual
 * "Scrape now". */
export function ClientFormModal({
  singular,
  workspaceId,
  existingId,
  onClose,
  onSaved,
}: {
  singular: string;
  workspaceId: string | null;
  /** When set, the modal edits this client (fields load on open). */
  existingId?: string;
  onClose: () => void;
  onSaved: (clientId: string) => void;
}) {
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState<Industry>('Professional Services');
  const [isParent, setIsParent] = useState(false);
  const [scrapeSite, setScrapeSite] = useState(true);
  // Create-with-scrape runs inside the open modal so the user sees it happen.
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const createdIdRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  // Edit mode: what the row looked like on load, to detect a website change.
  const [loadedWebsite, setLoadedWebsite] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!existingId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingId || !supabase) return;
    let cancelled = false;
    supabase
      .from('clients')
      .select('name, website, industry, is_parent')
      .eq('id', existingId)
      .maybeSingle()
      .then(({ data, error: loadErr }) => {
        if (cancelled) return;
        setLoading(false);
        if (loadErr || !data) {
          setError(loadErr?.message ?? 'Client not found');
          return;
        }
        setName((data.name as string) ?? '');
        setWebsite((data.website as string | null) ?? '');
        setLoadedWebsite((data.website as string | null) ?? null);
        setIndustry(((data.industry as string) ?? 'Professional Services') as Industry);
        setIsParent(!!data.is_parent);
      });
    return () => {
      cancelled = true;
    };
  }, [existingId]);

  /** Scrape → AI-jobs chain (create + edit-with-new-URL). Resolves to an
   * error message, or null on success. Awaited by create (visible progress);
   * edit calls it detached. Survives unmount either way — it holds no
   * component refs beyond harmless setState. */
  async function runIntelligenceChain(
    clientId: string,
    ws: string,
    site: string,
  ): Promise<string | null> {
    try {
      const { data, error: fnErr } = await supabase!.functions.invoke('scrape-client', {
        body: { client_id: clientId, url: site },
      });
      if (fnErr) {
        // Non-2xx hides the function's real message behind a generic
        // FunctionsHttpError; the body sits on error.context.
        let text: string | null = null;
        if ('context' in fnErr) {
          try {
            text = (await (fnErr.context as Response).json())?.error ?? null;
          } catch {
            /* body not JSON */
          }
        }
        return text ?? fnErr.message ?? 'Scrape failed';
      }
      if (!data?.ok) return data?.error ?? 'Scrape returned no pages';
      enqueueJob({
        type: 'website_analysis',
        workspaceId: ws,
        clientId,
        input: { url: site },
      }).catch((e) => console.warn('Brand analysis enqueue failed:', e));
      enqueueJob({
        type: 'location_detection',
        workspaceId: ws,
        clientId,
        input: {},
      }).catch((e) => console.warn('Location detection enqueue failed:', e));
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  /** Hand the created/edited client to the parent exactly once — the scrape
   * chain may still resolve after the user clicked "Continue in background". */
  function fireSaved(clientId: string) {
    if (savedRef.current) return;
    savedRef.current = true;
    onSaved(clientId);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !workspaceId) {
      setError(`Editing ${singular}s is available in the live app (sign in to a workspace).`);
      return;
    }
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);

    const site = website.trim();
    if (existingId) {
      const { error: updErr } = await supabase
        .from('clients')
        .update({
          name: name.trim(),
          industry,
          is_parent: isParent,
          website: site || null,
        })
        .eq('id', existingId);
      if (updErr) {
        setSubmitting(false);
        setError(updErr.message);
        return;
      }
      // Website added or changed → (re)build the site intelligence.
      if (site && site !== (loadedWebsite ?? '')) {
        void runIntelligenceChain(existingId, workspaceId, site);
      }
      fireSaved(existingId);
      return;
    }

    const clientId = `${slugify(name)}-${randomSuffix()}`;
    const { error: insErr } = await supabase.from('clients').insert({
      id: clientId,
      name: name.trim(),
      industry,
      complete: 0,
      is_parent: isParent,
      website: site || null,
      workspace_id: workspaceId,
    });
    if (insErr) {
      setSubmitting(false);
      setError(insErr.message);
      return;
    }
    createdIdRef.current = clientId;
    if (site && scrapeSite) {
      // Visible scrape: the modal shows progress, then lands on the client
      // with Scraped Pages done and Brand analysis running.
      setScraping(true);
      const scrapeErr = await runIntelligenceChain(clientId, workspaceId, site);
      setScraping(false);
      if (scrapeErr) {
        // The client exists either way — surface the error and let the user
        // proceed (Scraped Pages has a manual "Scrape now" retry).
        setSubmitting(false);
        setScrapeError(scrapeErr);
        return;
      }
    }
    fireSaved(clientId);
  }

  // Once the client row exists, any dismissal means "continue in background":
  // the scrape chain keeps running detached and the parent still gets the id.
  function dismiss() {
    if (createdIdRef.current) fireSaved(createdIdRef.current);
    else onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
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
      <form
        className="card card-pad stack gap-10"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        style={{ width: 'min(440px, 100%)' }}
      >
        <div className="row between">
          <div style={{ fontWeight: 600 }}>
            {existingId ? `Edit ${singular}` : `Add ${singular}`}
          </div>
          <button type="button" className="btn ghost sm" onClick={dismiss}>
            <Icon name="close" size={14} />
          </button>
        </div>
        {loading ? (
          <div className="meta">Loading…</div>
        ) : scraping || scrapeError ? (
          <>
            <div className="meta">
              {scraping
                ? `Scraping ${website.trim()}… usually under a minute. The Brand and Scraped Pages tabs fill in from this.`
                : null}
            </div>
            {scrapeError && (
              <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
                ⚠ Client created, but the scrape failed: {scrapeError}. You can retry from
                the Scraped Pages tab.
              </div>
            )}
            <div className="row gap-6">
              <button
                type="button"
                className="btn primary sm"
                onClick={() => fireSaved(createdIdRef.current!)}
              >
                {scraping ? 'Continue in background' : 'Open client'}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="stack gap-4">
              <span className="meta">Name</span>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Dental"
                style={inputStyle}
                disabled={submitting}
              />
            </label>
            <label className="stack gap-4">
              <span className="meta">Website (optional — scraped for brand intelligence)</span>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://acmedental.com"
                style={inputStyle}
                disabled={submitting}
              />
            </label>
            <label className="stack gap-4">
              <span className="meta">Industry</span>
              <select
                className="input"
                value={industry}
                onChange={(e) => setIndustry(e.target.value as Industry)}
                disabled={submitting}
                style={{ ...inputStyle, appearance: 'auto' }}
              >
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
            <label className="row gap-8" style={{ alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isParent}
                onChange={(e) => setIsParent(e.target.checked)}
                disabled={submitting}
              />
              <span className="meta">Has multiple locations</span>
            </label>
            {!existingId && (
              <label className="row gap-8" style={{ alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={scrapeSite && !!website.trim()}
                  onChange={(e) => setScrapeSite(e.target.checked)}
                  disabled={submitting || !website.trim()}
                />
                <span className="meta">
                  Scrape site on create — fills the Scraped Pages + Brand tabs
                </span>
              </label>
            )}
            {existingId && website.trim() && website.trim() !== (loadedWebsite ?? '') && (
              <div className="meta" style={{ fontSize: 11 }}>
                Saving will scrape this website and refresh the brand profile + location
                detection in the background.
              </div>
            )}
            {error && (
              <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
                ⚠ {error}
              </div>
            )}
            <div className="row gap-6">
              <button type="submit" className="btn primary sm" disabled={submitting}>
                {submitting
                  ? 'Saving…'
                  : existingId
                    ? 'Save changes'
                    : `Create ${singular}`}
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--fg)',
  padding: '8px 10px',
  font: 'inherit',
  fontSize: 13,
};
