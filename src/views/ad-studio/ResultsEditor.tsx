// Editable generation results: Google Ads + META sections with inline
// editing, add/delete, per-item AI regenerate, and "Add more with AI"
// (the donor app's Results-tab affordances, condensed).

import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { enqueueJob, useJob } from '../../data/useJob';

export interface GoogleAdsOutput {
  keywords: string[];
  headlines: string[];
  descriptions: string[];
  signals: string[];
}

export interface MetaOutput {
  primary_text: string[];
  headlines: string[];
}

export interface GenerationResults {
  google_ads?: GoogleAdsOutput;
  meta?: MetaOutput;
}

type ListKey =
  | 'keywords'
  | 'headlines'
  | 'descriptions'
  | 'signals'
  | 'meta_primary_text'
  | 'meta_headlines';

interface ListSpec {
  key: ListKey;
  title: string;
  charLimit: number | null;
  badge: boolean;
  multiline: boolean;
  expected: string | null;
  regenType: string | null;
  read: (r: GenerationResults) => string[];
  write: (r: GenerationResults, items: string[]) => GenerationResults;
}

const GOOGLE_LISTS: ListSpec[] = [
  {
    key: 'keywords',
    title: 'Keywords',
    charLimit: null,
    badge: true,
    multiline: false,
    expected: null,
    regenType: 'keyword',
    read: (r) => r.google_ads?.keywords ?? [],
    write: (r, items) => ({
      ...r,
      google_ads: { ...(r.google_ads as GoogleAdsOutput), keywords: items },
    }),
  },
  {
    key: 'headlines',
    title: 'Headlines',
    charLimit: 30,
    badge: false,
    multiline: false,
    expected: '15 expected',
    regenType: 'google_headline',
    read: (r) => r.google_ads?.headlines ?? [],
    write: (r, items) => ({
      ...r,
      google_ads: { ...(r.google_ads as GoogleAdsOutput), headlines: items },
    }),
  },
  {
    key: 'descriptions',
    title: 'Descriptions',
    charLimit: 90,
    badge: false,
    multiline: false,
    expected: '10 expected',
    regenType: 'google_description',
    read: (r) => r.google_ads?.descriptions ?? [],
    write: (r, items) => ({
      ...r,
      google_ads: { ...(r.google_ads as GoogleAdsOutput), descriptions: items },
    }),
  },
  {
    key: 'signals',
    title: 'Audience signals',
    charLimit: null,
    badge: true,
    multiline: false,
    expected: '50 expected',
    regenType: 'signal',
    read: (r) => r.google_ads?.signals ?? [],
    write: (r, items) => ({
      ...r,
      google_ads: { ...(r.google_ads as GoogleAdsOutput), signals: items },
    }),
  },
];

const META_LISTS: ListSpec[] = [
  {
    key: 'meta_primary_text',
    title: 'Primary text',
    charLimit: null,
    badge: false,
    multiline: true,
    expected: '5 expected',
    regenType: 'meta_primary_text',
    read: (r) => r.meta?.primary_text ?? [],
    write: (r, items) => ({
      ...r,
      meta: { ...(r.meta as MetaOutput), primary_text: items },
    }),
  },
  {
    key: 'meta_headlines',
    title: 'Headlines',
    charLimit: 25,
    badge: false,
    multiline: false,
    expected: '5 expected',
    regenType: 'meta_headline',
    read: (r) => r.meta?.headlines ?? [],
    write: (r, items) => ({
      ...r,
      meta: { ...(r.meta as MetaOutput), headlines: items },
    }),
  },
];

export function ResultsEditor({
  results,
  onChange,
  medium,
  workspaceId,
  clientId,
}: {
  results: GenerationResults;
  onChange: (next: GenerationResults) => void;
  medium: 'GOOGLE_ADS' | 'META' | 'BOTH';
  workspaceId: string;
  clientId: string;
}) {
  const showGoogle = medium !== 'META' && !!results.google_ads;
  const showMeta = medium !== 'GOOGLE_ADS' && !!results.meta;

  return (
    <div className="stack gap-16">
      {showGoogle && (
        <PlatformSection
          title="Google Ads"
          lists={GOOGLE_LISTS}
          results={results}
          onChange={onChange}
          workspaceId={workspaceId}
          clientId={clientId}
        />
      )}
      {showMeta && (
        <PlatformSection
          title="META (Facebook + Instagram)"
          lists={META_LISTS}
          results={results}
          onChange={onChange}
          workspaceId={workspaceId}
          clientId={clientId}
        />
      )}
    </div>
  );
}

function PlatformSection({
  title,
  lists,
  results,
  onChange,
  workspaceId,
  clientId,
}: {
  title: string;
  lists: ListSpec[];
  results: GenerationResults;
  onChange: (next: GenerationResults) => void;
  workspaceId: string;
  clientId: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="card">
      <div
        className="card-pad row between"
        style={{ borderBottom: collapsed ? 0 : '1px solid var(--border)', cursor: 'pointer' }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="h2">{title}</span>
        <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} />
      </div>
      {!collapsed &&
        lists.map((spec) => (
          <EditableList
            key={spec.key}
            spec={spec}
            results={results}
            onChange={onChange}
            workspaceId={workspaceId}
            clientId={clientId}
          />
        ))}
    </div>
  );
}

function EditableList({
  spec,
  results,
  onChange,
  workspaceId,
  clientId,
}: {
  spec: ListSpec;
  results: GenerationResults;
  onChange: (next: GenerationResults) => void;
  workspaceId: string;
  clientId: string;
}) {
  const items = spec.read(results);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addValue, setAddValue] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [regenIndex, setRegenIndex] = useState<number | null>(null);

  function setItems(next: string[]) {
    onChange(spec.write(results, next));
  }

  function commitEdit() {
    if (editingIndex === null) return;
    const next = [...items];
    if (editValue.trim()) next[editingIndex] = editValue.trim();
    setItems(next);
    setEditingIndex(null);
  }

  const overLimit = (s: string) => spec.charLimit !== null && s.length > spec.charLimit;

  return (
    <div className="card-pad stack gap-8" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="row between">
        <span
          className="meta"
          style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          {spec.title} · {items.length}
          {spec.expected ? ` (${spec.expected})` : ''}
          {spec.charLimit ? ` · max ${spec.charLimit} chars` : ''}
        </span>
        <div className="row gap-6">
          <button className="btn sm" onClick={() => setAddingManual((v) => !v)}>
            + Add
          </button>
          <button className="btn ai sm" onClick={() => setExpandOpen((v) => !v)}>
            <Icon name="sparkles" size={11} /> Add more with AI
          </button>
        </div>
      </div>

      {addingManual && (
        <div className="row gap-6">
          <input
            autoFocus
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addValue.trim()) {
                setItems([...items, addValue.trim()]);
                setAddValue('');
              }
              if (e.key === 'Escape') setAddingManual(false);
            }}
            placeholder={`New ${spec.title.toLowerCase().replace(/s$/, '')}…`}
            style={editorInputStyle}
          />
          <button
            className="btn primary sm"
            onClick={() => {
              if (!addValue.trim()) return;
              setItems([...items, addValue.trim()]);
              setAddValue('');
            }}
          >
            Add
          </button>
        </div>
      )}

      {expandOpen && (
        <ExpandPanel
          spec={spec}
          existing={items}
          workspaceId={workspaceId}
          clientId={clientId}
          onItems={(newItems) => {
            setItems([...items, ...newItems]);
            setExpandOpen(false);
          }}
          onClose={() => setExpandOpen(false)}
        />
      )}

      {regenIndex !== null && (
        <RegenPanel
          spec={spec}
          value={items[regenIndex]}
          workspaceId={workspaceId}
          clientId={clientId}
          onValue={(v) => {
            const next = [...items];
            next[regenIndex] = v;
            setItems(next);
            setRegenIndex(null);
          }}
          onClose={() => setRegenIndex(null)}
        />
      )}

      {spec.badge ? (
        <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
          {items.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="pill gray"
              style={{ cursor: 'pointer', gap: 6 }}
              onClick={() => {
                setEditingIndex(i);
                setEditValue(item);
              }}
            >
              {editingIndex === i ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') setEditingIndex(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ ...editorInputStyle, padding: '2px 6px', fontSize: 11, width: 140 }}
                />
              ) : (
                <>
                  {item}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setItems(items.filter((_, j) => j !== i));
                    }}
                    style={{ cursor: 'pointer', opacity: 0.6 }}
                  >
                    ×
                  </span>
                </>
              )}
            </span>
          ))}
        </div>
      ) : (
        <div className="stack gap-6">
          {items.map((item, i) => (
            <div
              key={`${i}-${item.slice(0, 12)}`}
              className="ai-surface card-pad row between"
              style={{ gap: 8, alignItems: 'flex-start' }}
            >
              {editingIndex === i ? (
                spec.multiline ? (
                  <textarea
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    style={{ ...editorInputStyle, minHeight: 80, flex: 1, resize: 'vertical' }}
                  />
                ) : (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') setEditingIndex(null);
                    }}
                    style={{ ...editorInputStyle, flex: 1 }}
                  />
                )
              ) : (
                <span
                  style={{ fontSize: 13, whiteSpace: 'pre-wrap', flex: 1, cursor: 'text' }}
                  onClick={() => {
                    setEditingIndex(i);
                    setEditValue(item);
                  }}
                >
                  {item}
                </span>
              )}
              <div className="row gap-6" style={{ flexShrink: 0, alignItems: 'center' }}>
                {spec.charLimit !== null && (
                  <span
                    className="meta"
                    style={{
                      fontSize: 11,
                      color: overLimit(item) ? 'var(--danger, #c33)' : undefined,
                      fontWeight: overLimit(item) ? 600 : undefined,
                    }}
                  >
                    {item.length}/{spec.charLimit}
                  </span>
                )}
                {spec.regenType && (
                  <button
                    className="btn ghost sm"
                    title="Regenerate with AI"
                    onClick={() => setRegenIndex(i)}
                    style={{ padding: '2px 6px' }}
                  >
                    <Icon name="refresh" size={11} />
                  </button>
                )}
                <button
                  className="btn ghost sm"
                  title="Delete"
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                  style={{ padding: '2px 6px' }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpandPanel({
  spec,
  existing,
  workspaceId,
  clientId,
  onItems,
  onClose,
}: {
  spec: ListSpec;
  existing: string[];
  workspaceId: string;
  clientId: string;
  onItems: (items: string[]) => void;
  onClose: () => void;
}) {
  const [suggestion, setSuggestion] = useState('');
  const [count, setCount] = useState(10);
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { job, running, failed, completed } = useJob<{ items: string[] }>(jobId);

  useEffect(() => {
    if (completed && job?.result?.items) onItems(job.result.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  async function start() {
    setStartError(null);
    try {
      const id = await enqueueJob({
        type: 'expand_content',
        workspaceId,
        clientId,
        input: { target: spec.key, existing, suggestion, count },
      });
      setJobId(id);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div
      className="stack gap-6"
      style={{ paddingLeft: 12, borderLeft: '2px solid var(--accent)' }}
    >
      <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
        <input
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          placeholder="Direction (e.g. focus on summer themes)…"
          style={{ ...editorInputStyle, flex: 1, minWidth: 220 }}
          disabled={running}
        />
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          style={editorInputStyle}
          disabled={running}
        >
          {[5, 10, 15, 20].map((n) => (
            <option key={n} value={n}>
              +{n}
            </option>
          ))}
        </select>
        <button className="btn primary sm" onClick={start} disabled={running}>
          {running ? `Generating… ${job?.progress ?? 0}%` : 'Generate'}
        </button>
        <button className="btn ghost sm" onClick={onClose} disabled={running}>
          Cancel
        </button>
      </div>
      {(startError || failed) && (
        <span className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
          ⚠ {startError ?? job?.error}
        </span>
      )}
    </div>
  );
}

function RegenPanel({
  spec,
  value,
  workspaceId,
  clientId,
  onValue,
  onClose,
}: {
  spec: ListSpec;
  value: string;
  workspaceId: string;
  clientId: string;
  onValue: (v: string) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { job, running, failed, completed } = useJob<{ value: string }>(jobId);

  useEffect(() => {
    if (completed && job?.result?.value) onValue(job.result.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  async function start() {
    setStartError(null);
    try {
      const id = await enqueueJob({
        type: 'regenerate_single',
        workspaceId,
        clientId,
        input: { item_type: spec.regenType, current_value: value, instruction },
      });
      setJobId(id);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div
      className="stack gap-6"
      style={{ paddingLeft: 12, borderLeft: '2px solid var(--accent)' }}
    >
      <span className="meta" style={{ fontSize: 11 }}>
        Rewriting: "{value}"
      </span>
      <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional instruction (e.g. more urgency)…"
          style={{ ...editorInputStyle, flex: 1, minWidth: 220 }}
          disabled={running}
        />
        <button className="btn primary sm" onClick={start} disabled={running}>
          {running ? 'Rewriting…' : 'Rewrite'}
        </button>
        <button className="btn ghost sm" onClick={onClose} disabled={running}>
          Cancel
        </button>
      </div>
      {(startError || failed) && (
        <span className="meta" style={{ color: 'var(--danger, #c33)', fontSize: 11 }}>
          ⚠ {startError ?? job?.error}
        </span>
      )}
    </div>
  );
}

const editorInputStyle: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--fg)',
  padding: '8px 10px',
  font: 'inherit',
  fontSize: 13,
  outline: 'none',
};
