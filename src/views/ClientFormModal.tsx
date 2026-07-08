import { useEffect, useState, type FormEvent } from 'react';
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

/** Create or edit a client. Create mirrors LiveOnboard's first-client step:
 * insert the row, then chain scrape → website_analysis + location_detection
 * in the background when a website was given. Edit updates the row and runs
 * the same chain when the website was added or changed — so a client whose
 * original scrape never happened gets one by simply saving its URL here.
 * The chain is best-effort; the Scraped Pages tab has a manual "Scrape now". */
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

  /** Detached scrape → AI-jobs chain (shared by create + edit-with-new-URL). */
  function runIntelligenceChain(clientId: string, ws: string, site: string) {
    (async () => {
      try {
        const { data } = await supabase!.functions.invoke('scrape-client', {
          body: { client_id: clientId, url: site },
        });
        if (!data?.ok) return;
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
      } catch (e) {
        console.warn('Client scrape failed:', e);
      }
    })();
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
        runIntelligenceChain(existingId, workspaceId, site);
      }
      onSaved(existingId);
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
    if (site) runIntelligenceChain(clientId, workspaceId, site);
    onSaved(clientId);
  }

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
          <button type="button" className="btn ghost sm" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
        {loading ? (
          <div className="meta">Loading…</div>
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
