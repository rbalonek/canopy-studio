import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../auth/supabaseClient';
import { Icon } from '../components/Icon';
import { fetchMetaAssets, type MetaAssets } from '../lib/metaAssets';
import { randomSuffix, slugify } from './ClientFormModal';

/**
 * Post-connect "bring in your clients" popup: lists every ad account the
 * workspace Meta credential can see, one row per account, with a checkbox
 * (approve specific or all), an editable client name, and a Facebook Page
 * dropdown pre-matched by name. Importing creates the client rows +
 * meta_accounts assignments and fire-and-forgets a first campaign pull per
 * client. Ad accounts already assigned to a client are shown but locked.
 *
 * Auto-opened by Settings → Connections when landing back from the OAuth
 * callback (?meta=connected); also reachable any time from the same panel
 * and the Clients page — new ad accounts granted to the connection later
 * show up on the next open.
 */
export function MetaImportClientsModal({
  workspaceId,
  singular = 'client',
  onClose,
  onImported,
}: {
  workspaceId: string;
  singular?: string;
  onClose: () => void;
  /** Called after a successful import with the created client ids. */
  onImported?: (clientIds: string[]) => void;
}) {
  const [assets, setAssets] = useState<MetaAssets | null>(null);
  const [linked, setLinked] = useState<Set<string>>(new Set());
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [rows, setRows] = useState<
    Record<string, { checked: boolean; name: string; pageId: string }>
  >({});
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ created: string[]; errors: string[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) return setLoadErr('Supabase not configured');
      try {
        const [a, { data: existing }] = await Promise.all([
          fetchMetaAssets(workspaceId),
          supabase.from('meta_accounts').select('account_id'),
        ]);
        if (cancelled) return;
        const linkedIds = new Set(
          (existing ?? [])
            .map((r) => (r.account_id as string | null) ?? '')
            .filter(Boolean)
            .map(normalizeActId),
        );
        setAssets(a);
        setLinked(linkedIds);
        const init: Record<string, { checked: boolean; name: string; pageId: string }> = {};
        for (const acct of a.adAccounts) {
          const already = linkedIds.has(normalizeActId(acct.id));
          init[acct.id] = {
            checked: !already,
            name: acct.name ?? acct.id,
            pageId: matchPage(acct.name, a)?.id ?? '',
          };
        }
        setRows(init);
      } catch (e) {
        if (!cancelled) setLoadErr((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const importable = useMemo(
    () => (assets?.adAccounts ?? []).filter((a) => !linked.has(normalizeActId(a.id))),
    [assets, linked],
  );
  const selectedCount = importable.filter((a) => rows[a.id]?.checked).length;
  const allSelected = importable.length > 0 && selectedCount === importable.length;

  function setAll(checked: boolean) {
    setRows((r) => {
      const next = { ...r };
      for (const a of importable) next[a.id] = { ...next[a.id], checked };
      return next;
    });
  }

  async function runImport() {
    if (!supabase || !assets) return;
    setImporting(true);
    const created: string[] = [];
    const errors: string[] = [];
    for (const acct of importable) {
      const row = rows[acct.id];
      if (!row?.checked) continue;
      const clientName = row.name.trim() || acct.name || acct.id;
      const clientId = `${slugify(clientName)}-${randomSuffix()}`;
      const { error: insErr } = await supabase.from('clients').insert({
        id: clientId,
        name: clientName,
        industry: 'Professional Services',
        complete: 0,
        is_parent: false,
        website: null,
        workspace_id: workspaceId,
      });
      if (insErr) {
        errors.push(`${clientName}: ${insErr.message}`);
        continue;
      }
      const page = assets.pages.find((p) => p.id === row.pageId) ?? null;
      const { error: metaErr } = await supabase.from('meta_accounts').upsert(
        {
          client_id: clientId,
          account_id: acct.id,
          page_id: page?.id ?? null,
          instagram_business_account_id: page?.ig?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' },
      );
      if (metaErr) {
        errors.push(`${clientName}: created, but Meta assignment failed — ${metaErr.message}`);
      } else {
        supabase.functions
          .invoke('meta-refresh-client', { body: { client_id: clientId } })
          .catch((e) => console.warn('Initial Meta refresh failed:', e));
      }
      created.push(clientId);
    }
    setImporting(false);
    setDone({ created, errors });
    if (created.length) onImported?.(created);
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
      <div
        className="card card-pad stack gap-12"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(640px, 100%)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div className="row between">
          <div style={{ fontWeight: 600 }}>Import {singular}s from Meta</div>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        {done ? (
          <>
            <div className="meta">
              ✓ Imported {done.created.length} {singular}
              {done.created.length === 1 ? '' : 's'}. Campaigns are pulling in the background —
              they'll appear on each {singular} shortly.
            </div>
            {done.errors.length > 0 && (
              <div className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
                ⚠ {done.errors.length} failed: {done.errors.slice(0, 3).join(' | ')}
              </div>
            )}
            <div className="row gap-6">
              <button type="button" className="btn primary sm" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : !assets && !loadErr ? (
          <div className="meta">Loading your ad accounts…</div>
        ) : loadErr ? (
          <div className="meta" style={{ color: 'var(--danger, #c33)' }}>
            ⚠ {loadErr}
          </div>
        ) : (
          <>
            <div className="meta" style={{ fontSize: 12 }}>
              These are the ad accounts your Meta connection can see. Approve the ones to bring in
              as {singular}s — each gets its ad account (and Page, when matched) attached and its
              campaigns pulled. Grant the connection access to more accounts later and they'll
              appear here.
            </div>

            {assets!.adAccounts.length === 0 ? (
              <div className="meta">
                The connection can't see any ad accounts — check which assets were granted during
                the Facebook login.
              </div>
            ) : (
              <>
                <label className="row gap-8" style={{ alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setAll(e.target.checked)}
                    disabled={importing || importable.length === 0}
                  />
                  <span className="meta">
                    Select all ({selectedCount}/{importable.length} selected
                    {linked.size > 0 ? ` · ${assets!.adAccounts.length - importable.length} already linked` : ''}
                    )
                  </span>
                </label>

                <div className="stack gap-8">
                  {assets!.adAccounts.map((acct) => {
                    const already = linked.has(normalizeActId(acct.id));
                    const row = rows[acct.id];
                    return (
                      <div
                        key={acct.id}
                        className="row gap-8"
                        style={{
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          opacity: already ? 0.55 : 1,
                          padding: '6px 8px',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={already ? false : (row?.checked ?? false)}
                          onChange={(e) =>
                            setRows((r) => ({
                              ...r,
                              [acct.id]: { ...r[acct.id], checked: e.target.checked },
                            }))
                          }
                          disabled={importing || already}
                        />
                        <div className="stack gap-2" style={{ minWidth: 140 }}>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                            {acct.id}
                          </span>
                          {already && <span className="tag">already linked</span>}
                        </div>
                        {!already && (
                          <>
                            <input
                              type="text"
                              className="input"
                              value={row?.name ?? ''}
                              onChange={(e) =>
                                setRows((r) => ({
                                  ...r,
                                  [acct.id]: { ...r[acct.id], name: e.target.value },
                                }))
                              }
                              placeholder={acct.name ?? 'Client name'}
                              style={{ flex: 1, minWidth: 140, fontSize: 12 }}
                              disabled={importing || !row?.checked}
                            />
                            <select
                              className="input"
                              value={row?.pageId ?? ''}
                              onChange={(e) =>
                                setRows((r) => ({
                                  ...r,
                                  [acct.id]: { ...r[acct.id], pageId: e.target.value },
                                }))
                              }
                              style={{ maxWidth: 200, fontSize: 12, appearance: 'auto' }}
                              disabled={importing || !row?.checked}
                            >
                              <option value="">No Page</option>
                              {assets!.pages.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name ?? p.id}
                                  {p.ig ? ` · IG` : ''}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="row gap-6">
                  <button
                    type="button"
                    className="btn primary sm"
                    onClick={runImport}
                    disabled={importing || selectedCount === 0}
                  >
                    {importing
                      ? 'Importing…'
                      : `Import ${selectedCount} ${singular}${selectedCount === 1 ? '' : 's'}`}
                  </button>
                  <button type="button" className="btn ghost sm" onClick={onClose} disabled={importing}>
                    Not now
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function normalizeActId(id: string): string {
  return id.replace(/^act_/, '');
}

/** Best-effort Page pre-match for an ad account by normalized name. */
function matchPage(accountName: string | null, assets: MetaAssets) {
  if (!accountName) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(accountName);
  if (!target) return null;
  return (
    assets.pages.find((p) => p.name && norm(p.name) === target) ??
    assets.pages.find(
      (p) => p.name && (norm(p.name).includes(target) || target.includes(norm(p.name))),
    ) ??
    null
  );
}
